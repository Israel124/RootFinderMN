import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import dotenv from "dotenv";

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

async function initDb() {
  if (!pool || !process.env.DATABASE_URL) {
    console.warn("DATABASE_URL not found. Skipping DB initialization.");
    return;
  }
    try {
      const client = await pool.connect();
      console.log("Database connection established.");
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

      // Check if label column exists (for existing databases)
      const columnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='calculations' AND column_name='label';
      `);
      if (columnCheck.rowCount === 0) {
        await client.query('ALTER TABLE calculations ADD COLUMN label TEXT;');
      }

      client.release();
      console.log("Database initialized successfully.");
    } catch (err) {
      console.error("FATAL: Error initializing database:", err);
    }
}

async function startServer() {
  const app = express();
  const parsedPort = Number(process.env.PORT);
  const PORT = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 4000;

  app.use(express.json());

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
    const item = req.body;
    
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
    const { label, ...otherData } = req.body;
    
    try {
      if (Object.keys(otherData).length > 0) {
        // Full update if more data is provided
        const item = otherData;
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
            Date.now(), req.params.id
          ]
        );
      } else {
        // Just update label
        await pool.query("UPDATE calculations SET label = $1 WHERE id = $2", [label, req.params.id]);
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
      await pool.query("DELETE FROM calculations WHERE id = $1", [req.params.id]);
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
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
