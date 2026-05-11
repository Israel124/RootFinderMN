import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { AddressInfo } from "net";
import { sendVerificationEmail } from "./src/lib/emailService.js";
import {
  clearHistory,
  createUser,
  deleteHistoryItem,
  findUserByEmail,
  initStorage,
  listHistory,
  markUserVerified,
  saveHistoryItem,
  storageMode,
  updateUserVerificationCode,
  updateHistoryItem,
} from "./server-storage.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-in-production";
const HISTORY_FILE = path.join(__dirname, 'history.json');
const USERS_FILE = path.join(__dirname, 'users.json');

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

async function resendVerificationCode(email: string) {
  const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  const updatedUser = await updateUserVerificationCode(USERS_FILE, email, verificationCode, expiresAt);

  if (!updatedUser) {
    return { codeSaved: false, emailSent: false, verificationCode: null, error: "No se pudo actualizar el codigo de verificacion" };
  }

  const emailResult = await sendVerificationEmail(email, verificationCode);
  if (!emailResult.success) {
    console.error("Verification email resend failed:", emailResult.error);
    return {
      codeSaved: true,
      emailSent: false,
      verificationCode,
      error: emailResult.error || "No se pudo enviar el email de verificacion",
    };
  }

  return { codeSaved: true, emailSent: true, verificationCode: null, error: null };
}

async function initDb() {
  console.log("Initializing storage...");
  await initStorage(USERS_FILE, HISTORY_FILE);
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

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", storage: storageMode, timestamp: new Date().toISOString() });
  });

  // Auth Routes
  app.post("/api/register", async (req, res) => {
    const { email, password } = req.body;
    const safeEmail = sanitizeText(email, 100).toLowerCase();
    const safePassword = sanitizeText(password, 100);

    if (!safeEmail || !safePassword) {
      return res.status(400).json({ error: "Email y contraseña requeridos" });
    }

    try {
      const existingUser = await findUserByEmail(USERS_FILE, safeEmail);
      if (existingUser) {
        return res.status(400).json({ error: "Usuario ya existe" });
      }

      const hashedPassword = await bcrypt.hash(safePassword, 10);
      const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      const newUser = await createUser(USERS_FILE, {
        email: safeEmail,
        password: hashedPassword,
        verified: false,
        verificationCode,
        expiresAt,
      });

      // Send verification email
      const emailResult = await sendVerificationEmail(safeEmail, verificationCode);

      if (!emailResult.success) {
        console.error('Verification email failed:', emailResult.error);
        return res.status(201).json({
          message: "Usuario registrado. No se pudo enviar el email de verificación.",
          warning: "No se pudo enviar el email de verificación. Usa el código mostrado para continuar.",
          requiresVerification: true,
          email: safeEmail,
          emailSent: false,
          verificationCode,
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
    const safeEmail = sanitizeText(email, 100).toLowerCase();
    const safePassword = sanitizeText(password, 100);

    if (!safeEmail || !safePassword) {
      return res.status(400).json({ error: "Email y contraseña requeridos" });
    }

    try {
      const user = await findUserByEmail(USERS_FILE, safeEmail);
      if (!user) {
        return res.status(400).json({ error: "Usuario no encontrado" });
      }

      const validPassword = await bcrypt.compare(safePassword, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: "Contraseña incorrecta" });
      }

      if (!user.verified) {
        const resendResult = await resendVerificationCode(safeEmail);
        return res.status(resendResult.codeSaved ? 403 : 500).json({
          error: resendResult.emailSent
            ? "Cuenta no verificada. Te enviamos un nuevo codigo de verificacion."
            : "Cuenta no verificada. No se pudo enviar el email, usa el codigo mostrado para continuar.",
          requiresVerification: true,
          email: safeEmail,
          emailSent: resendResult.emailSent,
          verificationCode: resendResult.verificationCode,
          emailError: resendResult.error,
        });
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
    const safeEmail = sanitizeText(email, 100).toLowerCase();
    const safeCode = sanitizeText(code, 10).toUpperCase();

    if (!safeEmail || !safeCode) {
      return res.status(400).json({ error: "Email y código requeridos" });
    }

    try {
      const user = await findUserByEmail(USERS_FILE, safeEmail);
      if (!user) {
        return res.status(400).json({ error: "Usuario no encontrado" });
      }

      if (user.verified) {
        return res.status(400).json({ error: "Cuenta ya verificada" });
      }

      if (user.verificationCode !== safeCode || !user.expiresAt || Date.now() > user.expiresAt) {
        return res.status(400).json({ error: "Código inválido o expirado" });
      }

      const verifiedUser = await markUserVerified(USERS_FILE, safeEmail);
      if (!verifiedUser) {
        return res.status(400).json({ error: "Usuario no encontrado" });
      }

      const token = jwt.sign({ id: verifiedUser.id, email: verifiedUser.email }, JWT_SECRET);
      res.json({ token, user: { id: verifiedUser.id, email: verifiedUser.email } });
    } catch (err) {
      console.error('Verify Error:', err);
      res.status(500).json({ error: "Error al verificar cuenta" });
    }
  });

  app.get("/api/me", authenticateToken, async (req, res) => {
    try {
      const authUser = (req as any).user;
      const user = await findUserByEmail(USERS_FILE, sanitizeText(authUser?.email, 100).toLowerCase());

      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
        },
      });
    } catch (err) {
      console.error('Me Error:', err);
      res.status(500).json({ error: "No se pudo validar la sesion" });
    }
  });

  // API Routes
  app.get("/api/history", authenticateToken, async (req, res) => {
    try {
      const history = await listHistory(HISTORY_FILE, (req as any).user.id);
      res.json(history);
    } catch (err) {
      console.error('Fetch History Error:', err);
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
      await saveHistoryItem(HISTORY_FILE, (req as any).user.id, item);
      res.status(201).json({ success: true });
    } catch (err) {
      console.error('Save Calculation Error:', err);
      res.status(500).json({ error: "Error al guardar el cálculo: " + (err as Error).message });
    }
  });

  app.patch("/api/history/:id", authenticateToken, async (req, res) => {
    const safeId = sanitizeText(req.params.id, 80);
    const { label, ...otherData } = req.body;
    
    try {
      if (Object.keys(otherData).length > 0) {
        const item = sanitizeCalculationPayload({ ...otherData, label });
        await updateHistoryItem(HISTORY_FILE, (req as any).user.id, safeId, item, sanitizeText(label, 120) || null);
      } else {
        await updateHistoryItem(HISTORY_FILE, (req as any).user.id, safeId, null, sanitizeText(label, 120));
      }
      res.status(200).json({ success: true });
    } catch (err) {
      console.error('Update Item Error:', err);
      res.status(500).json({ error: "No se pudo actualizar el registro" });
    }
  });

  app.delete("/api/history/:id", authenticateToken, async (req, res) => {
    try {
      await deleteHistoryItem(HISTORY_FILE, (req as any).user.id, sanitizeText(req.params.id, 80));
      res.status(200).json({ success: true });
    } catch (err) {
      console.error('Delete History Error:', err);
      res.status(500).json({ error: "Failed to delete item" });
    }
  });

  app.delete("/api/history", authenticateToken, async (req, res) => {
    try {
      await clearHistory(HISTORY_FILE, (req as any).user.id);
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
