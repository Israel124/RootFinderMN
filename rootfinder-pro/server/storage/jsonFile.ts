import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import {
  type AppUser,
  type CalculationRecord,
  type CalculationRecordWithUser,
  type CreateSessionInput,
  type CreateUserInput,
  type HealthSnapshot,
  type SessionRecord,
  type StorageEngine,
  type UpdateProfileInput,
} from "../types.js";

interface JsonStorageFiles {
  usersFile: string;
  historyFile: string;
  sessionsFile: string;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Implementa un lock por archivo usando un `.lock` adyacente.
 */
async function withFileLock<T>(filePath: string, worker: () => Promise<T>): Promise<T> {
  const lockFile = `${filePath}.lock`;
  const start = Date.now();

  while (true) {
    try {
      const handle = await fs.open(lockFile, "wx");
      try {
        return await worker();
      } finally {
        await handle.close();
        await fs.rm(lockFile, { force: true });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }

      if (Date.now() - start > 5000) {
        throw new Error(`No se pudo adquirir el lock para ${path.basename(filePath)}`);
      }

      await sleep(50);
    }
  }
}

async function ensureJsonFile(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, "[]", "utf8");
  }
}

async function readArrayFile<T>(filePath: string): Promise<T[]> {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

async function writeArrayFile<T>(filePath: string, items: T[]): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(items, null, 2), "utf8");
}

/**
 * Implementación de storage sobre archivos JSON.
 */
export class JsonFileStorage implements StorageEngine {
  readonly mode = "json" as const;
  private readonly files: JsonStorageFiles;

  constructor(files: JsonStorageFiles) {
    this.files = files;
  }

  /**
   * Crea los archivos base si aún no existen.
   */
  async init(): Promise<void> {
    await ensureJsonFile(this.files.usersFile);
    await ensureJsonFile(this.files.historyFile);
    await ensureJsonFile(this.files.sessionsFile);
  }

  /**
   * No requiere liberación de recursos persistentes.
   */
  async close(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Reporta el estado del storage local.
   */
  async getHealthSnapshot(): Promise<Pick<HealthSnapshot, "status" | "dbLatencyMs">> {
    try {
      const startedAt = performance.now();
      await fs.access(this.files.usersFile);
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
    const users = await readArrayFile<AppUser>(this.files.usersFile);
    return users.find((user) => user.email === email) ?? null;
  }

  /**
   * Busca un usuario por nombre.
   */
  async findUserByUsername(username: string): Promise<AppUser | null> {
    const users = await readArrayFile<AppUser>(this.files.usersFile);
    return users.find((user) => user.username === username) ?? null;
  }

  /**
   * Busca un usuario por id.
   */
  async findUserById(id: string): Promise<AppUser | null> {
    const users = await readArrayFile<AppUser>(this.files.usersFile);
    return users.find((user) => user.id === id) ?? null;
  }

  /**
   * Crea un usuario nuevo en el archivo JSON.
   */
  async createUser(input: CreateUserInput): Promise<AppUser> {
    return withFileLock(this.files.usersFile, async () => {
      const users = await readArrayFile<AppUser>(this.files.usersFile);
      const now = Date.now();
      const user: AppUser = {
        id: randomUUID(),
        username: input.username,
        email: input.email,
        passwordHash: input.passwordHash,
        verified: input.verified,
        verificationCode: input.verificationCode,
        verificationExpiresAt: input.verificationExpiresAt,
        createdAt: now,
        updatedAt: now,
      };

      users.push(user);
      await writeArrayFile(this.files.usersFile, users);
      return user;
    });
  }

  /**
   * Actualiza el código de verificación de un usuario pendiente.
   */
  async updateUserVerificationCode(email: string, code: string, expiresAt: number): Promise<AppUser | null> {
    return withFileLock(this.files.usersFile, async () => {
      const users = await readArrayFile<AppUser>(this.files.usersFile);
      const index = users.findIndex((user) => user.email === email && !user.verified);
      if (index === -1) {
        return null;
      }

      users[index] = {
        ...users[index],
        verificationCode: code,
        verificationExpiresAt: expiresAt,
        updatedAt: Date.now(),
      };

      await writeArrayFile(this.files.usersFile, users);
      return users[index];
    });
  }

  /**
   * Marca un usuario como verificado.
   */
  async markUserVerified(email: string): Promise<AppUser | null> {
    return withFileLock(this.files.usersFile, async () => {
      const users = await readArrayFile<AppUser>(this.files.usersFile);
      const index = users.findIndex((user) => user.email === email);
      if (index === -1) {
        return null;
      }

      users[index] = {
        ...users[index],
        verified: true,
        verificationCode: null,
        verificationExpiresAt: null,
        updatedAt: Date.now(),
      };

      await writeArrayFile(this.files.usersFile, users);
      return users[index];
    });
  }

  /**
   * Actualiza username o email del perfil.
   */
  async updateUserProfile(userId: string, input: UpdateProfileInput): Promise<AppUser | null> {
    return withFileLock(this.files.usersFile, async () => {
      const users = await readArrayFile<AppUser>(this.files.usersFile);
      const index = users.findIndex((user) => user.id === userId);
      if (index === -1) {
        return null;
      }

      users[index] = {
        ...users[index],
        username: input.username ?? users[index].username,
        email: input.email ?? users[index].email,
        updatedAt: Date.now(),
      };

      await writeArrayFile(this.files.usersFile, users);
      return users[index];
    });
  }

  /**
   * Crea una sesión persistente.
   */
  async createSession(input: CreateSessionInput): Promise<SessionRecord> {
    return withFileLock(this.files.sessionsFile, async () => {
      const sessions = await readArrayFile<SessionRecord>(this.files.sessionsFile);
      const now = Date.now();
      const session: SessionRecord = {
        id: randomUUID(),
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        createdAt: now,
        updatedAt: now,
      };

      sessions.push(session);
      await writeArrayFile(this.files.sessionsFile, sessions);
      return session;
    });
  }

  /**
   * Busca una sesión por hash.
   */
  async findSessionByTokenHash(refreshTokenHash: string): Promise<SessionRecord | null> {
    const sessions = await readArrayFile<SessionRecord>(this.files.sessionsFile);
    return sessions.find((session) => session.refreshTokenHash === refreshTokenHash) ?? null;
  }

  /**
   * Revoca una sesión puntual.
   */
  async revokeSession(sessionId: string): Promise<void> {
    await withFileLock(this.files.sessionsFile, async () => {
      const sessions = await readArrayFile<SessionRecord>(this.files.sessionsFile);
      await writeArrayFile(
        this.files.sessionsFile,
        sessions.filter((session) => session.id !== sessionId),
      );
    });
  }

  /**
   * Revoca todas las sesiones de un usuario.
   */
  async revokeSessionsByUser(userId: string): Promise<void> {
    await withFileLock(this.files.sessionsFile, async () => {
      const sessions = await readArrayFile<SessionRecord>(this.files.sessionsFile);
      await writeArrayFile(
        this.files.sessionsFile,
        sessions.filter((session) => session.userId !== userId),
      );
    });
  }

  /**
   * Lista el historial del usuario.
   */
  async listHistory(userId: string): Promise<CalculationRecord[]> {
    const history = await readArrayFile<CalculationRecordWithUser>(this.files.historyFile);
    return history
      .filter((item) => item.userId === userId)
      .sort((left, right) => right.timestamp - left.timestamp)
      .map(({ userId: _userId, ...item }) => item);
  }

  /**
   * Inserta o reemplaza un elemento del historial.
   */
  async saveHistoryItem(userId: string, item: CalculationRecord): Promise<CalculationRecord> {
    await withFileLock(this.files.historyFile, async () => {
      const history = await readArrayFile<CalculationRecordWithUser>(this.files.historyFile);
      const filtered = history.filter((entry) => !(entry.id === item.id && entry.userId === userId));
      filtered.unshift({
        ...item,
        userId,
      });
      await writeArrayFile(this.files.historyFile, filtered);
    });

    return item;
  }

  /**
   * Actualiza parcialmente un elemento del historial.
   */
  async updateHistoryItem(userId: string, id: string, item: Partial<CalculationRecord>): Promise<CalculationRecord | null> {
    return withFileLock(this.files.historyFile, async () => {
      const history = await readArrayFile<CalculationRecordWithUser>(this.files.historyFile);
      const index = history.findIndex((entry) => entry.id === id && entry.userId === userId);
      if (index === -1) {
        return null;
      }

      history[index] = {
        ...history[index],
        ...item,
        id,
        userId,
        updatedAt: Date.now(),
      };

      await writeArrayFile(this.files.historyFile, history);
      const { userId: _userId, ...record } = history[index];
      return record;
    });
  }

  /**
   * Elimina un item del historial.
   */
  async deleteHistoryItem(userId: string, id: string): Promise<void> {
    await withFileLock(this.files.historyFile, async () => {
      const history = await readArrayFile<CalculationRecordWithUser>(this.files.historyFile);
      await writeArrayFile(
        this.files.historyFile,
        history.filter((entry) => !(entry.userId === userId && entry.id === id)),
      );
    });
  }

  /**
   * Borra todo el historial del usuario.
   */
  async clearHistory(userId: string): Promise<void> {
    await withFileLock(this.files.historyFile, async () => {
      const history = await readArrayFile<CalculationRecordWithUser>(this.files.historyFile);
      await writeArrayFile(
        this.files.historyFile,
        history.filter((entry) => entry.userId !== userId),
      );
    });
  }
}

