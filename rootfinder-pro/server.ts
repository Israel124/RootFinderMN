import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import dotenv from "dotenv";
import type { AddressInfo } from "net";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

const pool = process.env.DATABASE_URL 
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    })
  : null;

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

async function initDb() {
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
            label TEXT
          );
        `);

        const columnCheck = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name='calculations' AND column_name='label';
        `);
        if (columnCheck.rowCount === 0) {
          await client.query('ALTER TABLE calculations ADD COLUMN label TEXT;');
        }
      } finally {
        client.release();
      }
      console.log("Database initialized successfully.");
    } catch (err) {
      console.error("FATAL: Error initializing database:", err);
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

  // API Routes
  app.get("/api/history", async (req, res) => {
    if (!pool) return res.json([]);
    try {
      const result = await pool.query("SELECT * FROM calculations ORDER BY timestamp DESC LIMIT 50");
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
      res.status(500).json({ error: "No se pudo obtener el historial de la base de datos" });
    }
  });

  app.post("/api/history", async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Base de datos no configurada (DATABASE_URL faltante)" });
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
        (id, timestamp, method, function_f, function_g, root, error, iterations, converged, message, params, label)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
          label = EXCLUDED.label`,
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
          item.label || null
        ]
      );
      res.status(201).json({ success: true });
    } catch (err) {
      console.error('Save Calculation Error:', err);
      res.status(500).json({ error: "Error al guardar el cálculo en la base de datos: " + (err as Error).message });
    }
  });

  app.patch("/api/history/:id", async (req, res) => {
    if (!pool) return res.status(200).end();
    const safeId = sanitizeText(req.params.id, 80);
    const { label, ...otherData } = req.body;
    
    try {
      if (Object.keys(otherData).length > 0) {
        // Full update if more data is provided
        const item = sanitizeCalculationPayload({ ...otherData, label });
        await pool.query(
          `UPDATE calculations SET 
            method = $1, function_f = $2, function_g = $3, root = $4, 
            error = $5, iterations = $6, converged = $7, message = $8, 
            params = $9, label = $10, timestamp = $11
          WHERE id = $12`,
          [
            item.method, item.functionF, item.functionG || null, item.root,
            item.error, JSON.stringify(item.iterations), item.converged, 
            item.message, JSON.stringify(item.params), label || item.label || null,
            Date.now(), safeId
          ]
        );
      } else {
        await pool.query("UPDATE calculations SET label = $1 WHERE id = $2", [sanitizeText(label, 120), safeId]);
      }
      res.status(200).json({ success: true });
    } catch (err) {
      console.error('Update Item Error:', err);
      res.status(500).json({ error: "No se pudo actualizar el registro" });
    }
  });

  app.delete("/api/history/:id", async (req, res) => {
    if (!pool || !process.env.DATABASE_URL) return res.status(200).end();
    try {
      await pool.query("DELETE FROM calculations WHERE id = $1", [sanitizeText(req.params.id, 80)]);
      res.status(200).json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete item" });
    }
  });

  app.delete("/api/history", async (req, res) => {
    if (!pool || !process.env.DATABASE_URL) return res.status(200).end();
    try {
      await pool.query("DELETE FROM calculations");
      res.status(200).json({ success: true });
    } catch (err) {
      console.error(err);
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
    app.use(express.static(distPath));
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
