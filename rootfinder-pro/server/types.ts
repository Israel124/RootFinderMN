import type { Request } from "express";

export type StorageMode = "postgres" | "json";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  username: string;
  type: "access";
  sessionId?: string;
  iat?: number;
  exp?: number;
}

export interface AppUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  verified: boolean;
  verificationCode: string | null;
  verificationExpiresAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  verified: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CalculationRecord {
  id: string;
  timestamp: number;
  method: string;
  functionF: string;
  functionG: string | null;
  root: number | null;
  error: number | null;
  iterations: JsonObject[];
  converged: boolean;
  message: string;
  params: JsonObject;
  label: string | null;
  updatedAt: number;
}

export interface CalculationRecordWithUser extends CalculationRecord {
  userId: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: number;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface HealthSnapshot {
  status: "ok" | "degraded" | "error";
  storage: StorageMode;
  dbLatencyMs: number;
  uptime: number;
  memoryMB: number;
  timestamp: string;
}

export interface CreateUserInput {
  username: string;
  email: string;
  passwordHash: string;
  verified: boolean;
  verificationCode: string | null;
  verificationExpiresAt: number | null;
}

export interface UpdateProfileInput {
  username?: string;
  email?: string;
}

export interface CreateSessionInput {
  userId: string;
  refreshTokenHash: string;
  expiresAt: number;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface StorageEngine {
  readonly mode: StorageMode;
  init(): Promise<void>;
  close(): Promise<void>;
  getHealthSnapshot(): Promise<Pick<HealthSnapshot, "status" | "dbLatencyMs">>;
  findUserByEmail(email: string): Promise<AppUser | null>;
  findUserByUsername(username: string): Promise<AppUser | null>;
  findUserById(id: string): Promise<AppUser | null>;
  createUser(input: CreateUserInput): Promise<AppUser>;
  updateUserVerificationCode(email: string, code: string, expiresAt: number): Promise<AppUser | null>;
  markUserVerified(email: string): Promise<AppUser | null>;
  updateUserProfile(userId: string, input: UpdateProfileInput): Promise<AppUser | null>;
  createSession(input: CreateSessionInput): Promise<SessionRecord>;
  findSessionByTokenHash(refreshTokenHash: string): Promise<SessionRecord | null>;
  revokeSession(sessionId: string): Promise<void>;
  revokeSessionsByUser(userId: string): Promise<void>;
  listHistory(userId: string): Promise<CalculationRecord[]>;
  saveHistoryItem(userId: string, item: CalculationRecord): Promise<CalculationRecord>;
  updateHistoryItem(userId: string, id: string, item: Partial<CalculationRecord>): Promise<CalculationRecord | null>;
  deleteHistoryItem(userId: string, id: string): Promise<void>;
  clearHistory(userId: string): Promise<void>;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthTokenPayload;
  session?: SessionRecord;
}

export interface AppContext {
  storage: StorageEngine;
  config: AppConfig;
}

export interface AppConfig {
  port: number;
  host: string;
  nodeEnv: string;
  appOrigin: string;
  corsOrigins: string[];
  accessTokenSecret: string;
  refreshTokenCookieName: string;
  accessTokenTtlMs: number;
  refreshTokenTtlMs: number;
  dataDirectory: string;
  usersFile: string;
  historyFile: string;
  sessionsFile: string;
}

