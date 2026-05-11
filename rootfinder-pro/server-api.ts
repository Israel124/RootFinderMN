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
  findUserByUsername,
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
const HISTORY_FILE = path.join(__dirname, "history.json");
const USERS_FILE = path.join(__dirname, "users.json");

function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token requerido" });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: "Token invalido" });
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

function hasSequentialDigits(password: string) {
  const digitsOnly = password.replace(/\D/g, "");
  if (digitsOnly.length < 4) return false;

  for (let i = 0; i <= digitsOnly.length - 4; i++) {
    let ascending = true;
    let descending = true;

    for (let j = 1; j < 4; j++) {
      const current = Number(digitsOnly[i + j]);
      const previous = Number(digitsOnly[i + j - 1]);
      if (current !== previous + 1) ascending = false;
      if (current !== previous - 1) descending = false;
    }

    if (ascending || descending) return true;
  }

  return false;
}

function sanitizeUsername(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_.-]/g, "")
    .slice(0, 40);
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
    throw new Error("Payload invalido");
  }

  const method = sanitizeText(input.method, 40);
  if (!ALLOWED_METHODS.has(method)) {
    throw new Error(`Metodo invalido: ${method}`);
  }

  return {
    id: sanitizeText(input.id, 80),
    timestamp: Number.isFinite(Number(input.timestamp)) ? Number(input.timestamp) : Date.now(),
    method,
    functionF: sanitizeText(input.functionF || input.functionF1 || input.fx || "", 2000),
    functionG: sanitizeText(input.functionG || input.functionF2 || "", 2000) || null,
    root: input.root === null || input.root === undefined ? (input.solution?.x ?? null) : sanitizeNumber(input.root),
    error: input.error === null || input.error === undefined ? null : sanitizeNumber(input.error),
    iterations: sanitizeIterations(input.iterations),
    converged: Boolean(input.converged),
    message: sanitizeText(input.message, 1000),
    params: sanitizeJsonRecord(input.params),
    label: sanitizeText(input.label, 120) || null,
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

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 10000;

  app.disable("x-powered-by");
  app.use(express.json({ limit: "200kb" }));
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

  await initStorage(USERS_FILE, HISTORY_FILE);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", storage: storageMode, timestamp: new Date().toISOString() });
  });

  app.post("/api/register", async (req, res) => {
    const safeUsername = sanitizeUsername(req.body.username);
    const safeEmail = sanitizeText(req.body.email, 100).toLowerCase();
    const safePassword = sanitizeText(req.body.password, 100);

    if (!safeUsername || !safeEmail || !safePassword) {
      return res.status(400).json({ error: "Nombre de usuario, email y contrasena son requeridos" });
    }

    if (safeUsername.length < 3) {
      return res.status(400).json({ error: "El nombre de usuario debe tener al menos 3 caracteres" });
    }

    if (hasSequentialDigits(safePassword)) {
      return res.status(400).json({ error: "La contrasena no puede contener secuencias numericas como 1234 o 4321" });
    }

    try {
      const existingUser = await findUserByEmail(USERS_FILE, safeEmail);
      if (existingUser) {
        return res.status(400).json({ error: "Usuario ya existe" });
      }

      const existingUsername = await findUserByUsername(USERS_FILE, safeUsername);
      if (existingUsername) {
        return res.status(400).json({ error: "El nombre de usuario ya esta en uso" });
      }

      const hashedPassword = await bcrypt.hash(safePassword, 10);
      const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

      await createUser(USERS_FILE, {
        username: safeUsername,
        email: safeEmail,
        password: hashedPassword,
        verified: false,
        verificationCode,
        expiresAt,
      });

      const emailResult = await sendVerificationEmail(safeEmail, verificationCode);
      if (!emailResult.success) {
        console.error("Verification email failed:", emailResult.error);
        return res.status(201).json({
          message: "Usuario registrado. No se pudo enviar el email de verificacion.",
          warning: "No se pudo enviar el email de verificacion. Usa el codigo mostrado para continuar.",
          requiresVerification: true,
          email: safeEmail,
          emailSent: false,
          verificationCode,
          emailError: emailResult.error,
        });
      }

      res.status(201).json({ message: "Usuario registrado. Revisa tu email para verificar la cuenta." });
    } catch (err) {
      console.error("Register Error:", err);
      res.status(500).json({ error: "Error al registrar usuario" });
    }
  });

  app.post("/api/login", async (req, res) => {
    const safeEmail = sanitizeText(req.body.email, 100).toLowerCase();
    const safePassword = sanitizeText(req.body.password, 100);

    if (!safeEmail || !safePassword) {
      return res.status(400).json({ error: "Email y contrasena requeridos" });
    }

    try {
      const user = await findUserByEmail(USERS_FILE, safeEmail);
      if (!user) {
        return res.status(400).json({ error: "Usuario no encontrado" });
      }

      const validPassword = await bcrypt.compare(safePassword, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: "Contrasena incorrecta" });
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

      const token = jwt.sign({ id: user.id, email: user.email, username: user.username }, JWT_SECRET);
      res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
    } catch (err) {
      console.error("Login Error:", err);
      res.status(500).json({ error: "Error al iniciar sesion" });
    }
  });

  app.post("/api/verify", async (req, res) => {
    const safeEmail = sanitizeText(req.body.email, 100).toLowerCase();
    const safeCode = sanitizeText(req.body.code, 10).toUpperCase();

    if (!safeEmail || !safeCode) {
      return res.status(400).json({ error: "Email y codigo requeridos" });
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
        return res.status(400).json({ error: "Codigo invalido o expirado" });
      }

      const verifiedUser = await markUserVerified(USERS_FILE, safeEmail);
      if (!verifiedUser) {
        return res.status(400).json({ error: "Usuario no encontrado" });
      }

      const token = jwt.sign({ id: verifiedUser.id, email: verifiedUser.email, username: verifiedUser.username }, JWT_SECRET);
      res.json({ token, user: { id: verifiedUser.id, username: verifiedUser.username, email: verifiedUser.email } });
    } catch (err) {
      console.error("Verify Error:", err);
      res.status(500).json({ error: "Error al verificar cuenta" });
    }
  });

  app.get("/api/history", authenticateToken, async (req, res) => {
    try {
      res.json(await listHistory(HISTORY_FILE, (req as any).user.id));
    } catch (err) {
      console.error("Load History Error:", err);
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
      return res.status(400).json({ error: "Datos incompletos para guardar el calculo" });
    }

    try {
      await saveHistoryItem(HISTORY_FILE, (req as any).user.id, item);
      res.status(201).json({ success: true });
    } catch (err) {
      console.error("Save History Error:", err);
      res.status(500).json({ error: "Error al guardar el calculo" });
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
      console.error("Update History Error:", err);
      res.status(500).json({ error: "No se pudo actualizar el registro" });
    }
  });

  app.delete("/api/history/:id", authenticateToken, async (req, res) => {
    try {
      await deleteHistoryItem(HISTORY_FILE, (req as any).user.id, sanitizeText(req.params.id, 80));
      res.status(200).json({ success: true });
    } catch (err) {
      console.error("Delete History Error:", err);
      res.status(500).json({ error: "Failed to delete item" });
    }
  });

  app.delete("/api/history", authenticateToken, async (req, res) => {
    try {
      await clearHistory(HISTORY_FILE, (req as any).user.id);
      res.status(200).json({ success: true });
    } catch (err) {
      console.error("Clear History Error:", err);
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
