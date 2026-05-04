import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs/promises";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pg from "pg";
import type { AddressInfo } from "net";
import { sendVerificationEmail } from "./src/lib/emailService.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-in-production";
const HISTORY_FILE = path.join(__dirname, 'history.json');
const USERS_FILE = path.join(__dirname, 'users.json');

const { Pool } = pg;
const pool = process.env.DATABASE_URL 
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    })
  : null;

async function loadUsers(): Promise<any[]> {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveUsers(users: any[]): Promise<void> {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

async function loadHistory(): Promise<any[]> {
  try {
    const data = await fs.readFile(HISTORY_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveHistory(history: any[]): Promise<void> {
  await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    (req as any).user = user;
    next();
  });
}

const ALLOWED_METHODS = new Set([
  "bisection",
  "false-position",
  "newton-raphson",
  "secant",
  "fixed-point",
  "muller",
  "bairstow",
  "horner",
  "taylor",
  "newton-raphson-system",
]);

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, maxLength);
}

function sanitizeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeJsonRecord(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const record: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input)) {
    const safeKey = sanitizeText(key, 60);
    if (!safeKey) continue;

    if (typeof value === "string") {
      record[safeKey] = sanitizeText(value, 300);
      continue;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      record[safeKey] = value;
      continue;
    }

    if (typeof value === "boolean" || value === null) {
      record[safeKey] = value;
    }
  }

  return record;
}

function sanitizeIterations(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.slice(0, 500).map((item) => sanitizeJsonRecord(item));
}

function sanitizeCalculationPayload(input: any) {
  if (!input || typeof input !== "object") {
    throw new Error("Payload inválido");
  }

  const method = sanitizeText(input.method, 40);
  if (!ALLOWED_METHODS.has(method)) {
    throw new Error(`Método inválido: ${method}`);
  }

  const iterations = sanitizeIterations(input.iterations);
  const params = sanitizeJsonRecord(input.params);

  return {
    id: sanitizeText(input.id, 80),
    timestamp: Number.isFinite(Number(input.timestamp)) ? Number(input.timestamp) : Date.now(),
    method,
    functionF: sanitizeText(input.functionF || input.functionF1 || input.fx || "", 2000),
    functionG: sanitizeText(input.functionG || input.functionF2 || "", 2000) || null,
    root: input.root === null || input.root === undefined ? (input.solution?.x ?? null) : sanitizeNumber(input.root),
    error: input.error === null || input.error === undefined ? null : sanitizeNumber(input.error),
    iterations,
    converged: Boolean(input.converged),
    message: sanitizeText(input.message, 1000),
    params,
    label: sanitizeText(input.label, 200) || null,
  };
}

async function ensureJsonFile(filePath: string) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, '[]', 'utf8');
  }
}

async function initDb() {
  console.log("Initializing storage...");
  await ensureJsonFile(USERS_FILE);
  await ensureJsonFile(HISTORY_FILE);

  if (!pool || !process.env.DATABASE_URL) {
    console.warn("DATABASE_URL not found. Skipping DB initialization.");
    return;
  }

  try {
    const client = await pool.connect();
    console.log("Database connection established.");
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS calculations (
          id UUID PRIMARY KEY,
          timestamp BIGINT NOT NULL,
          method TEXT NOT NULL,
          function_f TEXT NOT NULL,
          function_g TEXT,
          root DOUBLE PRECISION,
          error DOUBLE PRECISION,
          iterations JSONB NOT NULL,
          converged BOOLEAN NOT NULL,
          message TEXT,
          params JSONB NOT NULL,
          label TEXT,
          user_id TEXT
        );
      `);

      // Migration: Add user_id column if it doesn't exist
      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calculations' AND column_name='user_id') THEN
            ALTER TABLE calculations ADD COLUMN user_id TEXT;
          END IF;
        END $$;
      `);
    } finally {
      client.release();
    }
    console.log("PostgreSQL database initialized successfully.");
  } catch (err) {
    console.error("Error initializing PostgreSQL database:", err);
  }
}

async function startServer() {
  const app = express();
  const preferredPort = Number(process.env.PORT) || 4000;

  app.disable("x-powered-by");
  app.use(express.json({ limit: "200kb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self';"
    );
    next();
  });

  await initDb();

  // Auth Routes
  app.post("/api/register", async (req, res) => {
    const { email, password } = req.body;
    const safeEmail = sanitizeText(email, 100);
    const safePassword = sanitizeText(password, 100);

    if (!safeEmail || !safePassword) {
      return res.status(400).json({ error: "Email y contraseña requeridos" });
    }

    try {
      const users = await loadUsers();
      const existingUser = users.find(u => u.email === safeEmail);
      if (existingUser) {
        return res.status(400).json({ error: "Usuario ya existe" });
      }

      const hashedPassword = await bcrypt.hash(safePassword, 10);
      const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      const newUser = {
        id: Date.now().toString(),
        email: safeEmail,
        password: hashedPassword,
        verified: false,
        verificationCode,
        expiresAt,
        createdAt: Date.now()
      };

      // Send verification email
      const emailResult = await sendVerificationEmail(safeEmail, verificationCode);
      users.push(newUser);
      await saveUsers(users);

      if (!emailResult.success) {
        console.error('Verification email failed:', emailResult.error);
        return res.status(500).json({
          message: "Usuario registrado. No se pudo enviar el email de verificación.",
          warning: "No se pudo enviar el email de verificación. Usa el código mostrado para continuar.",
          emailError: emailResult.error,
        });
      }

      res.status(201).json({ message: "Usuario registrado. Revisa tu email para verificar la cuenta." });
    } catch (err) {
      console.error('Register Error:', err);
      res.status(500).json({ error: "Error al registrar usuario" });
    }
  });

  app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    const safeEmail = sanitizeText(email, 100);
    const safePassword = sanitizeText(password, 100);

    if (!safeEmail || !safePassword) {
      return res.status(400).json({ error: "Email y contraseña requeridos" });
    }

    try {
      const users = await loadUsers();
      const user = users.find(u => u.email === safeEmail);
      if (!user) {
        return res.status(400).json({ error: "Usuario no encontrado" });
      }

      const validPassword = await bcrypt.compare(safePassword, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: "Contraseña incorrecta" });
      }

      if (!user.verified) {
        return res.status(400).json({ error: "Cuenta no verificada. Revisa tu email." });
      }

      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
      res.json({ token, user: { id: user.id, email: user.email } });
    } catch (err) {
      console.error('Login Error:', err);
      res.status(500).json({ error: "Error al iniciar sesión" });
    }
  });

  app.post("/api/verify", async (req, res) => {
    const { email, code } = req.body;
    const safeEmail = sanitizeText(email, 100);
    const safeCode = sanitizeText(code, 10);

    if (!safeEmail || !safeCode) {
      return res.status(400).json({ error: "Email y código requeridos" });
    }

    try {
      const users = await loadUsers();
      const userIndex = users.findIndex(u => u.email === safeEmail);
      if (userIndex === -1) {
        return res.status(400).json({ error: "Usuario no encontrado" });
      }

      const user = users[userIndex];
      if (user.verified) {
        return res.status(400).json({ error: "Cuenta ya verificada" });
      }

      if (user.verificationCode !== safeCode || Date.now() > user.expiresAt) {
        return res.status(400).json({ error: "Código inválido o expirado" });
      }

      user.verified = true;
      delete user.verificationCode;
      delete user.expiresAt;
      await saveUsers(users);

      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
      res.json({ token, user: { id: user.id, email: user.email } });
    } catch (err) {
      console.error('Verify Error:', err);
      res.status(500).json({ error: "Error al verificar cuenta" });
    }
  });

  // API Routes
  app.get("/api/history", authenticateToken, async (req, res) => {
    if (!pool) return res.json([]);
    try {
      const result = await pool.query(
        "SELECT * FROM calculations WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 50",
        [(req as any).user.id]
      );
      const history = result.rows.map(row => ({
        id: row.id,
        timestamp: Number(row.timestamp),
        method: row.method,
        functionF: row.function_f,
        functionG: row.function_g,
        root: row.root,
        error: row.error,
        iterations: row.iterations,
        converged: row.converged,
        message: row.message,
        params: row.params,
        label: row.label
      }));
      res.json(history);
    } catch (err) {
      console.error('Fetch History Error:', err);
      res.status(500).json({ error: "No se pudo cargar el historial" });
    }
  });

  app.post("/api/history", authenticateToken, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Base de datos no configurada" });
    let item;
    try {
      item = sanitizeCalculationPayload(req.body);
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }
    
    if (!item.id || !item.method || !item.functionF) {
      return res.status(400).json({ error: "Datos incompletos para guardar el cálculo" });
    }

    try {
      await pool.query(
        `INSERT INTO calculations 
        (id, timestamp, method, function_f, function_g, root, error, iterations, converged, message, params, label, user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) 
        DO UPDATE SET
          timestamp = EXCLUDED.timestamp,
          method = EXCLUDED.method,
          function_f = EXCLUDED.function_f,
          function_g = EXCLUDED.function_g,
          root = EXCLUDED.root,
          error = EXCLUDED.error,
          iterations = EXCLUDED.iterations,
          converged = EXCLUDED.converged,
          message = EXCLUDED.message,
          params = EXCLUDED.params,
          label = EXCLUDED.label,
          user_id = EXCLUDED.user_id`,
        [
          item.id,
          item.timestamp,
          item.method,
          item.functionF,
          item.functionG || null,
          item.root,
          item.error,
          JSON.stringify(item.iterations),
          item.converged,
          item.message,
          JSON.stringify(item.params),
          item.label || null,
          (req as any).user.id
        ]
      );
      res.status(201).json({ success: true });
    } catch (err) {
      console.error('Save Calculation Error:', err);
      res.status(500).json({ error: "Error al guardar el cálculo: " + (err as Error).message });
    }
  });

  app.patch("/api/history/:id", authenticateToken, async (req, res) => {
    if (!pool) return res.status(200).end();
    const safeId = sanitizeText(req.params.id, 80);
    const { label, ...otherData } = req.body;
    
    try {
      if (Object.keys(otherData).length > 0) {
        const item = sanitizeCalculationPayload({ ...otherData, label });
        await pool.query(
          `UPDATE calculations SET 
            method = $1, function_f = $2, function_g = $3, root = $4, 
            error = $5, iterations = $6, converged = $7, message = $8, 
            params = $9, label = $10, timestamp = $11
          WHERE id = $12 AND user_id = $13`,
          [
            item.method, item.functionF, item.functionG || null, item.root,
            item.error, JSON.stringify(item.iterations), item.converged, 
            item.message, JSON.stringify(item.params), label || item.label || null,
            Date.now(), safeId, (req as any).user.id
          ]
        );
      } else {
        await pool.query(
          "UPDATE calculations SET label = $1 WHERE id = $2 AND user_id = $3", 
          [sanitizeText(label, 120), safeId, (req as any).user.id]
        );
      }
      res.status(200).json({ success: true });
    } catch (err) {
      console.error('Update Item Error:', err);
      res.status(500).json({ error: "No se pudo actualizar el registro" });
    }
  });

  app.delete("/api/history/:id", authenticateToken, async (req, res) => {
    if (!pool) return res.status(200).end();
    try {
      await pool.query(
        "DELETE FROM calculations WHERE id = $1 AND user_id = $2", 
        [sanitizeText(req.params.id, 80), (req as any).user.id]
      );
      res.status(200).json({ success: true });
    } catch (err) {
      console.error('Delete History Error:', err);
      res.status(500).json({ error: "Failed to delete item" });
    }
  });

  app.delete("/api/history", authenticateToken, async (req, res) => {
    if (!pool) return res.status(200).end();
    try {
      await pool.query("DELETE FROM calculations WHERE user_id = $1", [(req as any).user.id]);
      res.status(200).json({ success: true });
    } catch (err) {
      console.error('Clear History Error:', err);
      res.status(500).json({ error: "Failed to clear history" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use("/RootFinderMN", express.static(distPath));
    app.use(express.static(distPath));
    app.get("/RootFinderMN", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    app.get("/RootFinderMN/*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const host = "0.0.0.0";
  const maxPortAttempts = 10;

  const listenOnPort = (port: number, attemptsLeft: number): void => {
    const server = app.listen(port, host, () => {
      const address = server.address() as AddressInfo | null;
      const activePort = address?.port ?? port;
      if (activePort !== preferredPort) {
        console.warn(`Port ${preferredPort} was busy. Server started on http://localhost:${activePort}`);
        console.warn(`If you are running the frontend from a browser, open or refresh http://localhost:${activePort} so API calls use the correct backend origin.`);
      } else {
        console.log(`Server running on http://localhost:${activePort}`);
      }
    });

    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE" && attemptsLeft > 0) {
        const nextPort = port + 1;
        console.warn(`Port ${port} is already in use. Retrying on ${nextPort}...`);
        listenOnPort(nextPort, attemptsLeft - 1);
        return;
      }

      throw error;
    });
  };

  listenOnPort(preferredPort, maxPortAttempts);
}

startServer();
