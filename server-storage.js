import fs from "fs/promises";
import { randomUUID } from "crypto";
import pg from "pg";
const { Pool } = pg;
export const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false,
        },
    })
    : null;
export const storageMode = pool ? "postgres" : "json";
export async function ensureJsonFile(filePath) {
    try {
        await fs.access(filePath);
    }
    catch {
        await fs.writeFile(filePath, "[]", "utf8");
    }
}
async function loadJsonArray(filePath) {
    try {
        const data = await fs.readFile(filePath, "utf8");
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
async function saveJsonArray(filePath, items) {
    await fs.writeFile(filePath, JSON.stringify(items, null, 2), "utf8");
}
function mapUserRow(row) {
    return {
        id: row.id,
        email: row.email,
        password: row.password_hash,
        verified: row.verified,
        verificationCode: row.verification_code,
        expiresAt: row.verification_expires_at === null ? null : Number(row.verification_expires_at),
        createdAt: Number(row.created_at),
    };
}
function mapCalculationRow(row) {
    return {
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
        label: row.label,
    };
}
export async function initStorage(usersFile, historyFile) {
    await ensureJsonFile(usersFile);
    await ensureJsonFile(historyFile);
    if (!pool) {
        console.warn("DATABASE_URL not found. Using local JSON files for persistence.");
        return;
    }
    const client = await pool.connect();
    try {
        await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        verified BOOLEAN NOT NULL DEFAULT FALSE,
        verification_code TEXT,
        verification_expires_at BIGINT,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );
    `);
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
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE
      );
    `);
        await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calculations' AND column_name='user_id') THEN
          ALTER TABLE calculations ADD COLUMN user_id TEXT;
        END IF;
      END $$;
    `);
        await client.query("CREATE INDEX IF NOT EXISTS calculations_user_timestamp_idx ON calculations (user_id, timestamp DESC);");
        const jsonUsers = await loadJsonArray(usersFile);
        for (const user of jsonUsers) {
            if (!user.id || !user.email || !user.password)
                continue;
            await client.query(`INSERT INTO users
          (id, email, password_hash, verified, verification_code, verification_expires_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (email) DO NOTHING`, [
                user.id,
                user.email,
                user.password,
                Boolean(user.verified),
                user.verificationCode || null,
                user.expiresAt || null,
                user.createdAt || Date.now(),
                Date.now(),
            ]);
        }
        const jsonHistory = await loadJsonArray(historyFile);
        for (const item of jsonHistory) {
            if (!item.id || !item.userId || !item.method || !item.functionF)
                continue;
            await client.query(`INSERT INTO calculations
          (id, timestamp, method, function_f, function_g, root, error, iterations, converged, message, params, label, user_id)
         SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
         WHERE EXISTS (SELECT 1 FROM users WHERE id = $13)
         ON CONFLICT (id) DO NOTHING`, [
                item.id,
                item.timestamp || Date.now(),
                item.method,
                item.functionF,
                item.functionG || null,
                item.root ?? null,
                item.error ?? null,
                JSON.stringify(item.iterations || []),
                Boolean(item.converged),
                item.message || "",
                JSON.stringify(item.params || {}),
                item.label || null,
                item.userId,
            ]);
        }
    }
    finally {
        client.release();
    }
    console.log("PostgreSQL storage initialized successfully.");
}
export async function findUserByEmail(usersFile, email) {
    if (pool) {
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        return result.rows[0] ? mapUserRow(result.rows[0]) : null;
    }
    const users = await loadJsonArray(usersFile);
    return users.find((user) => user.email === email) || null;
}
export async function createUser(usersFile, user) {
    const now = Date.now();
    const newUser = {
        id: user.id || randomUUID(),
        email: user.email,
        password: user.password,
        verified: user.verified,
        verificationCode: user.verificationCode,
        expiresAt: user.expiresAt,
        createdAt: user.createdAt || now,
    };
    if (pool) {
        await pool.query(`INSERT INTO users
        (id, email, password_hash, verified, verification_code, verification_expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
            newUser.id,
            newUser.email,
            newUser.password,
            newUser.verified,
            newUser.verificationCode || null,
            newUser.expiresAt || null,
            newUser.createdAt,
            now,
        ]);
        return newUser;
    }
    const users = await loadJsonArray(usersFile);
    users.push(newUser);
    await saveJsonArray(usersFile, users);
    return newUser;
}
export async function markUserVerified(usersFile, email) {
    if (pool) {
        const result = await pool.query(`UPDATE users
       SET verified = TRUE, verification_code = NULL, verification_expires_at = NULL, updated_at = $1
       WHERE email = $2
       RETURNING *`, [Date.now(), email]);
        return result.rows[0] ? mapUserRow(result.rows[0]) : null;
    }
    const users = await loadJsonArray(usersFile);
    const index = users.findIndex((user) => user.email === email);
    if (index === -1)
        return null;
    users[index].verified = true;
    users[index].verificationCode = null;
    users[index].expiresAt = null;
    await saveJsonArray(usersFile, users);
    return users[index];
}
export async function updateUserVerificationCode(usersFile, email, verificationCode, expiresAt) {
    if (pool) {
        const result = await pool.query(`UPDATE users
       SET verification_code = $1, verification_expires_at = $2, updated_at = $3
       WHERE email = $4 AND verified = FALSE
       RETURNING *`, [verificationCode, expiresAt, Date.now(), email]);
        return result.rows[0] ? mapUserRow(result.rows[0]) : null;
    }
    const users = await loadJsonArray(usersFile);
    const index = users.findIndex((user) => user.email === email && !user.verified);
    if (index === -1)
        return null;
    users[index].verificationCode = verificationCode;
    users[index].expiresAt = expiresAt;
    await saveJsonArray(usersFile, users);
    return users[index];
}
export async function listHistory(historyFile, userId) {
    if (pool) {
        const result = await pool.query("SELECT * FROM calculations WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 50", [userId]);
        return result.rows.map(mapCalculationRow);
    }
    const history = await loadJsonArray(historyFile);
    return history.filter((item) => item.userId === userId).slice(0, 50);
}
export async function saveHistoryItem(historyFile, userId, item) {
    if (pool) {
        await pool.query(`INSERT INTO calculations
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
         user_id = EXCLUDED.user_id`, [
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
            userId,
        ]);
        return;
    }
    const history = await loadJsonArray(historyFile);
    const filtered = history.filter((entry) => entry.id !== item.id || entry.userId !== userId);
    await saveJsonArray(historyFile, [{ ...item, userId }, ...filtered].slice(0, 50));
}
export async function updateHistoryItem(historyFile, userId, id, item, label) {
    if (pool) {
        if (item) {
            await saveHistoryItem(historyFile, userId, { ...item, id, timestamp: Date.now(), label: label || item.label || null });
            return;
        }
        await pool.query("UPDATE calculations SET label = $1 WHERE id = $2 AND user_id = $3", [label, id, userId]);
        return;
    }
    const history = await loadJsonArray(historyFile);
    const index = history.findIndex((entry) => entry.id === id && entry.userId === userId);
    if (index !== -1) {
        history[index] = item ? { ...item, timestamp: Date.now(), userId } : { ...history[index], label };
        await saveJsonArray(historyFile, history);
    }
}
export async function deleteHistoryItem(historyFile, userId, id) {
    if (pool) {
        await pool.query("DELETE FROM calculations WHERE id = $1 AND user_id = $2", [id, userId]);
        return;
    }
    const history = await loadJsonArray(historyFile);
    await saveJsonArray(historyFile, history.filter((entry) => !(entry.id === id && entry.userId === userId)));
}
export async function clearHistory(historyFile, userId) {
    if (pool) {
        await pool.query("DELETE FROM calculations WHERE user_id = $1", [userId]);
        return;
    }
    const history = await loadJsonArray(historyFile);
    await saveJsonArray(historyFile, history.filter((entry) => entry.userId !== userId));
}
