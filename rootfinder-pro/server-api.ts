import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs/promises";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { AddressInfo } from "net";
import { sendVerificationEmail } from "./src/lib/emailService.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-in-production";
const HISTORY_FILE = path.join(__dirname, 'history.json');
const USERS_FILE = path.join(__dirname, 'users.json');

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
    throw new Error("Método inválido");
  }

  const iterations = sanitizeIterations(input.iterations);
  const params = sanitizeJsonRecord(input.params);

  return {
    id: sanitizeText(input.id, 80),
    timestamp: Number.isFinite(Number(input.timestamp)) ? Number(input.timestamp) : Date.now(),
    method,
    functionF: sanitizeText(input.functionF, 1000),
    functionG: sanitizeText(input.functionG, 1000) || null,
    root: input.root === null ? null : sanitizeNumber(input.root),
    error: input.error === null ? null : sanitizeNumber(input.error),
    iterations,
    converged: Boolean(input.converged),
    message: sanitizeText(input.message, 500),
    params,
    label: sanitizeText(input.label, 120) || null,
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
  console.log("Using local JSON file for persistence.");
  await ensureJsonFile(USERS_FILE);
  await ensureJsonFile(HISTORY_FILE);
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 10000;

  app.disable("x-powered-by");
  app.use(express.json({ limit: "200kb" }));

  // CORS headers for production
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }

    next();
  });

  await initDb();

  // Health check
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

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
        return res.status(201).json({
          message: "Usuario registrado. No se pudo enviar el email de verificación.",
          warning: "No se pudo enviar el email de verificación. Usa el código mostrado para continuar.",
          emailError: emailResult.error,
          verificationCode,
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
    try {
      const history = await loadHistory();
      const userHistory = history.filter(h => h.userId === (req as any).user.id);
      res.json(userHistory.slice(0, 50));
    } catch (err) {
      console.error('Load History Error:', err);
      res.status(500).json({ error: "No se pudo cargar el historial" });
    }
  });

  app.post("/api/history", authenticateToken, async (req, res) => {
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
      const history = await loadHistory();
      const filtered = history.filter(h => h.id !== item.id || h.userId !== (req as any).user.id);
      const newItem = { ...item, userId: (req as any).user.id };
      const newHistory = [newItem, ...filtered].slice(0, 50);
      await saveHistory(newHistory);
      res.status(201).json({ success: true });
    } catch (err) {
      console.error('Save History Error:', err);
      res.status(500).json({ error: "Error al guardar el cálculo" });
    }
  });

  app.patch("/api/history/:id", authenticateToken, async (req, res) => {
    const safeId = sanitizeText(req.params.id, 80);
    const { label, ...otherData } = req.body;

    try {
      const history = await loadHistory();
      const index = history.findIndex(h => h.id === safeId && h.userId === (req as any).user.id);
      if (index !== -1) {
        if (Object.keys(otherData).length > 0) {
          const item = sanitizeCalculationPayload({ ...otherData, label });
          history[index] = { ...item, timestamp: Date.now(), userId: (req as any).user.id };
        } else {
          history[index].label = sanitizeText(label, 120);
        }
        await saveHistory(history);
      }
      res.status(200).json({ success: true });
    } catch (err) {
      console.error('Update History Error:', err);
      res.status(500).json({ error: "No se pudo actualizar el registro" });
    }
  });

  app.delete("/api/history/:id", authenticateToken, async (req, res) => {
    const safeId = sanitizeText(req.params.id, 80);
    try {
      const history = await loadHistory();
      const filtered = history.filter(h => !(h.id === safeId && h.userId === (req as any).user.id));
      await saveHistory(filtered);
      res.status(200).json({ success: true });
    } catch (err) {
      console.error('Delete History Error:', err);
      res.status(500).json({ error: "Failed to delete item" });
    }
  });

  app.delete("/api/history", authenticateToken, async (req, res) => {
    try {
      const history = await loadHistory();
      const filtered = history.filter(h => h.userId !== (req as any).user.id);
      await saveHistory(filtered);
      res.status(200).json({ success: true });
    } catch (err) {
      console.error('Clear History Error:', err);
      res.status(500).json({ error: "Failed to clear history" });
    }
  });

  const host = "0.0.0.0";
  const server = app.listen(port, host, () => {
    const address = server.address() as AddressInfo | null;
    const activePort = address?.port ?? port;
    console.log(`API Server running on http://${host}:${activePort}`);
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    console.error("Server error:", error);
    throw error;
  });
}

startServer();