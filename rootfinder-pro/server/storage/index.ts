import { JsonFileStorage } from "./jsonFile.js";
import { PostgresStorage } from "./postgres.js";
import type { AppConfig, StorageEngine } from "../types.js";

/**
 * Selecciona la implementación de storage adecuada según el entorno.
 */
export function createStorage(config: AppConfig): StorageEngine {
  if (process.env.DATABASE_URL) {
    return new PostgresStorage(process.env.DATABASE_URL);
  }

  return new JsonFileStorage({
    usersFile: config.usersFile,
    historyFile: config.historyFile,
    sessionsFile: config.sessionsFile,
  });
}

export type { StorageEngine } from "../types.js";

