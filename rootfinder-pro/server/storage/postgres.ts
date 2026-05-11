import { Pool } from "pg";
import {
  type AppUser,
  type CalculationRecord,
  type CreateSessionInput,
  type CreateUserInput,
  type HealthSnapshot,
  type SessionRecord,
  type StorageEngine,
  type UpdateProfileInput,
} from "../types.js";

function mapUser(row: Record<string, unknown>): AppUser {
  return {
    id: String(row.id),
    username: String(row.username),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    verified: Boolean(row.verified),
    verificationCode: row.verification_code ? String(row.verification_code) : null,
    verificationExpiresAt:
      row.verification_expires_at === null || row.verification_expires_at === undefined
        ? null
        : Number(row.verification_expires_at),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function mapCalculation(row: Record<string, unknown>): CalculationRecord {
  return {
    id: String(row.id),
    timestamp: Number(row.timestamp),
    method: String(row.method),
    functionF: String(row.function_f),
    functionG: row.function_g ? String(row.function_g) : null,
    root: row.root === null || row.root === undefined ? null : Number(row.root),
    error: row.error === null || row.error === undefined ? null : Number(row.error),
    iterations: Array.isArray(row.iterations) ? (row.iterations as CalculationRecord["iterations"]) : [],
    converged: Boolean(row.converged),
    message: String(row.message ?? ""),
    params: row.params && typeof row.params === "object" && !Array.isArray(row.params) ? (row.params as CalculationRecord["params"]) : {},
    label: row.label ? String(row.label) : null,
    updatedAt: Number(row.updated_at),
  };
}

function mapSession(row: Record<string, unknown>): SessionRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    refreshTokenHash: String(row.refresh_token),
    expiresAt: Number(row.expires_at),
    ipAddress: row.ip_address ? String(row.ip_address) : null,
    userAgent: row.user_agent ? String(row.user_agent) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

/**
 * Implementación de storage con PostgreSQL.
 */
export class PostgresStorage implements StorageEngine {
  readonly mode = "postgres" as const;
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: databaseUrl.includes("localhost")
        ? false
        : {
            rejectUnauthorized: false,
          },
    });
  }

  /**
   * Inicializa tablas, índices y triggers necesarios.
   */
  async init(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
      await client.query(`
        CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = EXTRACT(EPOCH FROM NOW()) * 1000;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
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
          id TEXT PRIMARY KEY,
          timestamp BIGINT NOT NULL,
          method TEXT NOT NULL,
          function_f TEXT NOT NULL,
          function_g TEXT,
          root DOUBLE PRECISION,
          error DOUBLE PRECISION,
          iterations JSONB NOT NULL,
          converged BOOLEAN NOT NULL,
          message TEXT NOT NULL DEFAULT '',
          params JSONB NOT NULL,
          label TEXT,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000),
          updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
          refresh_token TEXT UNIQUE NOT NULL,
          expires_at BIGINT NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
        );
      `);

      await client.query("CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users(email);");
      await client.query("CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users(username);");
      await client.query("CREATE INDEX IF NOT EXISTS calculations_user_timestamp_idx ON calculations(user_id, timestamp DESC);");
      await client.query("CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);");
      await client.query("CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);");

      await client.query("DROP TRIGGER IF EXISTS users_set_updated_at ON users;");
      await client.query("DROP TRIGGER IF EXISTS calculations_set_updated_at ON calculations;");
      await client.query("DROP TRIGGER IF EXISTS sessions_set_updated_at ON sessions;");

      await client.query(`
        CREATE TRIGGER users_set_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
      `);
      await client.query(`
        CREATE TRIGGER calculations_set_updated_at
        BEFORE UPDATE ON calculations
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
      `);
      await client.query(`
        CREATE TRIGGER sessions_set_updated_at
        BEFORE UPDATE ON sessions
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
      `);
    } finally {
      client.release();
    }
  }

  /**
   * Cierra el pool de conexiones.
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Reporta la salud del storage PostgreSQL.
   */
  async getHealthSnapshot(): Promise<Pick<HealthSnapshot, "status" | "dbLatencyMs">> {
    const startedAt = performance.now();

    try {
      await this.pool.query("SELECT 1");
      return {
        status: "ok",
        dbLatencyMs: Math.round((performance.now() - startedAt) * 100) / 100,
      };
    } catch {
      return {
        status: "error",
        dbLatencyMs: -1,
      };
    }
  }

  /**
   * Busca un usuario por email.
   */
  async findUserByEmail(email: string): Promise<AppUser | null> {
    const result = await this.pool.query("SELECT * FROM users WHERE email = $1 LIMIT 1", [email]);
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  /**
   * Busca un usuario por nombre.
   */
  async findUserByUsername(username: string): Promise<AppUser | null> {
    const result = await this.pool.query("SELECT * FROM users WHERE username = $1 LIMIT 1", [username]);
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  /**
   * Busca un usuario por id.
   */
  async findUserById(id: string): Promise<AppUser | null> {
    const result = await this.pool.query("SELECT * FROM users WHERE id = $1 LIMIT 1", [id]);
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  /**
   * Crea un usuario nuevo.
   */
  async createUser(input: CreateUserInput): Promise<AppUser> {
    const now = Date.now();
    const result = await this.pool.query(
      `
        INSERT INTO users (
          id, username, email, password_hash, verified, verification_code,
          verification_expires_at, created_at, updated_at
        )
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        input.username,
        input.email,
        input.passwordHash,
        input.verified,
        input.verificationCode,
        input.verificationExpiresAt,
        now,
        now,
      ],
    );

    return mapUser(result.rows[0]);
  }

  /**
   * Actualiza el código de verificación de un usuario.
   */
  async updateUserVerificationCode(email: string, code: string, expiresAt: number): Promise<AppUser | null> {
    const result = await this.pool.query(
      `
        UPDATE users
        SET verification_code = $1, verification_expires_at = $2
        WHERE email = $3 AND verified = FALSE
        RETURNING *
      `,
      [code, expiresAt, email],
    );

    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  /**
   * Marca un usuario como verificado.
   */
  async markUserVerified(email: string): Promise<AppUser | null> {
    const result = await this.pool.query(
      `
        UPDATE users
        SET verified = TRUE, verification_code = NULL, verification_expires_at = NULL
        WHERE email = $1
        RETURNING *
      `,
      [email],
    );

    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  /**
   * Actualiza datos editables del perfil.
   */
  async updateUserProfile(userId: string, input: UpdateProfileInput): Promise<AppUser | null> {
    const current = await this.findUserById(userId);
    if (!current) {
      return null;
    }

    const result = await this.pool.query(
      `
        UPDATE users
        SET username = $1, email = $2
        WHERE id = $3
        RETURNING *
      `,
      [input.username ?? current.username, input.email ?? current.email, userId],
    );

    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  /**
   * Crea una sesión persistente de refresh token.
   */
  async createSession(input: CreateSessionInput): Promise<SessionRecord> {
    const now = Date.now();
    const result = await this.pool.query(
      `
        INSERT INTO sessions (
          user_id, refresh_token, expires_at, ip_address, user_agent, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [input.userId, input.refreshTokenHash, input.expiresAt, input.ipAddress, input.userAgent, now, now],
    );

    return mapSession(result.rows[0]);
  }

  /**
   * Busca una sesión por hash del refresh token.
   */
  async findSessionByTokenHash(refreshTokenHash: string): Promise<SessionRecord | null> {
    const result = await this.pool.query(
      "SELECT * FROM sessions WHERE refresh_token = $1 LIMIT 1",
      [refreshTokenHash],
    );
    return result.rows[0] ? mapSession(result.rows[0]) : null;
  }

  /**
   * Revoca una sesión puntual.
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.pool.query("DELETE FROM sessions WHERE id = $1", [sessionId]);
  }

  /**
   * Revoca todas las sesiones de un usuario.
   */
  async revokeSessionsByUser(userId: string): Promise<void> {
    await this.pool.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
  }

  /**
   * Lista el historial del usuario desde el más reciente.
   */
  async listHistory(userId: string): Promise<CalculationRecord[]> {
    const result = await this.pool.query(
      "SELECT * FROM calculations WHERE user_id = $1 ORDER BY timestamp DESC",
      [userId],
    );
    return result.rows.map(mapCalculation);
  }

  /**
   * Inserta o reemplaza un cálculo.
   */
  async saveHistoryItem(userId: string, item: CalculationRecord): Promise<CalculationRecord> {
    const now = Date.now();
    const result = await this.pool.query(
      `
        INSERT INTO calculations (
          id, timestamp, method, function_f, function_g, root, error,
          iterations, converged, message, params, label, user_id, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11::jsonb, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
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
          user_id = EXCLUDED.user_id,
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `,
      [
        item.id,
        item.timestamp,
        item.method,
        item.functionF,
        item.functionG,
        item.root,
        item.error,
        JSON.stringify(item.iterations),
        item.converged,
        item.message,
        JSON.stringify(item.params),
        item.label,
        userId,
        now,
        now,
      ],
    );

    return mapCalculation(result.rows[0]);
  }

  /**
   * Actualiza un cálculo existente con merge parcial.
   */
  async updateHistoryItem(userId: string, id: string, item: Partial<CalculationRecord>): Promise<CalculationRecord | null> {
    const current = await this.pool.query(
      "SELECT * FROM calculations WHERE id = $1 AND user_id = $2 LIMIT 1",
      [id, userId],
    );

    if (!current.rows[0]) {
      return null;
    }

    const existing = mapCalculation(current.rows[0]);
    return this.saveHistoryItem(userId, {
      ...existing,
      ...item,
      id,
      updatedAt: Date.now(),
    });
  }

  /**
   * Elimina un elemento del historial.
   */
  async deleteHistoryItem(userId: string, id: string): Promise<void> {
    await this.pool.query("DELETE FROM calculations WHERE id = $1 AND user_id = $2", [id, userId]);
  }

  /**
   * Borra el historial completo del usuario.
   */
  async clearHistory(userId: string): Promise<void> {
    await this.pool.query("DELETE FROM calculations WHERE user_id = $1", [userId]);
  }
}

