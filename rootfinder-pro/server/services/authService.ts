import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { Response } from "express";
import type { AppConfig, AppContext, AuthTokenPayload, PublicUser, SessionRecord } from "../types.js";
import { generateRefreshToken, generateVerificationCode, hashToken } from "../utils/crypto.js";
import { logger } from "../utils/logger.js";
import { sanitizeEmail, sanitizeIpAddress, sanitizeText, sanitizeUsername } from "../utils/sanitize.js";
import { AppError } from "../middleware/errorHandler.js";
import { sendAccountVerificationEmail } from "./emailService.js";

function toPublicUser(user: {
  id: string;
  username: string;
  email: string;
  verified: boolean;
  createdAt: number;
  updatedAt: number;
}): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    verified: user.verified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function createAccessToken(config: AppConfig, payload: AuthTokenPayload): string {
  return jwt.sign(payload, config.accessTokenSecret, {
    expiresIn: Math.floor(config.accessTokenTtlMs / 1000),
  });
}

function applyRefreshCookie(config: AppConfig, response: Response, refreshToken: string) {
  response.cookie(config.refreshTokenCookieName, refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.nodeEnv === "production",
    maxAge: config.refreshTokenTtlMs,
    path: "/",
  });
}

function clearRefreshCookie(config: AppConfig, response: Response) {
  response.clearCookie(config.refreshTokenCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.nodeEnv === "production",
    path: "/",
  });
}

async function createSessionTokens(
  context: AppContext,
  user: PublicUser,
  meta: { ipAddress: string | null; userAgent: string | null },
): Promise<{ accessToken: string; refreshToken: string; session: SessionRecord }> {
  const refreshToken = generateRefreshToken();
  const expiresAt = Date.now() + context.config.refreshTokenTtlMs;
  const session = await context.storage.createSession({
    userId: user.id,
    refreshTokenHash: hashToken(refreshToken),
    expiresAt,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  const accessToken = createAccessToken(context.config, {
    sub: user.id,
    email: user.email,
    username: user.username,
    type: "access",
    sessionId: session.id,
  });

  return {
    accessToken,
    refreshToken,
    session,
  };
}

/**
 * Servicio de autenticación y sesiones.
 */
export class AuthService {
  private readonly context: AppContext;

  constructor(context: AppContext) {
    this.context = context;
  }

  private async deliverVerificationCode(email: string, verificationCode: string) {
    if (this.context.storage.mode === "json") {
      return {
        success: false as const,
        showCodeDirectly: true as const,
        error: "Modo local detectado: usa el código mostrado en pantalla.",
      };
    }

    const emailResult = await sendAccountVerificationEmail(email, verificationCode);
    return {
      ...emailResult,
      showCodeDirectly: false as const,
    };
  }

  /**
   * Registra un usuario nuevo y emite verificación por correo.
   */
  async register(input: { username: string; email: string; password: string }, response: Response) {
    const username = sanitizeUsername(input.username);
    const email = sanitizeEmail(input.email);
    const password = sanitizeText(input.password, 100);

    const existingEmail = await this.context.storage.findUserByEmail(email);
    if (existingEmail) {
      throw new AppError(409, "El correo ya está registrado");
    }

    const existingUsername = await this.context.storage.findUserByUsername(username);
    if (existingUsername) {
      throw new AppError(409, "El nombre de usuario ya está en uso");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationCode = generateVerificationCode();
    const verificationExpiresAt = Date.now() + 24 * 60 * 60 * 1000;

    const user = await this.context.storage.createUser({
      username,
      email,
      passwordHash,
      verified: false,
      verificationCode,
      verificationExpiresAt,
    });

    const emailResult = await this.deliverVerificationCode(email, verificationCode);
    if (!emailResult.success) {
      if (!emailResult.showCodeDirectly) {
        logger.warn("No se pudo enviar correo de verificación", {
          email,
          error: emailResult.error,
        });
      }

      clearRefreshCookie(this.context.config, response);
      return {
        message: emailResult.showCodeDirectly
          ? "Usuario registrado. Como estás en modo local, usa el código mostrado en pantalla."
          : "Usuario registrado. No se pudo enviar el email de verificación.",
        requiresVerification: true,
        email,
        emailSent: false,
        verificationCode,
        emailError: emailResult.error ?? "No se pudo enviar el correo",
        user: toPublicUser(user),
      };
    }

    clearRefreshCookie(this.context.config, response);
    return {
      message: "Usuario registrado. Revisa tu email para verificar la cuenta.",
      requiresVerification: true,
      email,
      emailSent: true,
      user: toPublicUser(user),
    };
  }

  /**
   * Inicia sesión y crea una nueva sesión persistente.
   */
  async login(
    input: { email: string; password: string },
    response: Response,
    meta: { ipAddress: string | null; userAgent: string | null },
  ) {
    const email = sanitizeEmail(input.email);
    const password = sanitizeText(input.password, 100);
    const user = await this.context.storage.findUserByEmail(email);

    if (!user) {
      logger.warn("Login fallido por usuario inexistente", { email, ipAddress: meta.ipAddress });
      throw new AppError(401, "Credenciales inválidas");
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      logger.warn("Login fallido por contraseña inválida", {
        email,
        userId: user.id,
        ipAddress: meta.ipAddress,
      });
      throw new AppError(401, "Credenciales inválidas");
    }

    if (!user.verified) {
      const verificationCode = generateVerificationCode();
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      await this.context.storage.updateUserVerificationCode(email, verificationCode, expiresAt);
      const emailResult = await this.deliverVerificationCode(email, verificationCode);

      clearRefreshCookie(this.context.config, response);
      return {
        requiresVerification: true,
        email,
        emailSent: emailResult.success,
        verificationCode: emailResult.success ? null : verificationCode,
        emailError: emailResult.success ? null : emailResult.error,
        error: emailResult.success
          ? "Cuenta no verificada. Te enviamos un nuevo código de verificación."
          : emailResult.showCodeDirectly
            ? "Cuenta no verificada. Estás en modo local, usa el código mostrado para continuar."
            : "Cuenta no verificada. No se pudo enviar el correo, usa el código mostrado para continuar.",
      };
    }

    const publicUser = toPublicUser(user);
    const tokens = await createSessionTokens(this.context, publicUser, meta);
    applyRefreshCookie(this.context.config, response, tokens.refreshToken);

    logger.info("Login exitoso", {
      userId: publicUser.id,
      email: publicUser.email,
      ipAddress: meta.ipAddress,
    });

    return {
      token: tokens.accessToken,
      accessToken: tokens.accessToken,
      user: publicUser,
    };
  }

  /**
   * Verifica la cuenta y crea sesión autenticada.
   */
  async verifyEmail(
    input: { email: string; code: string },
    response: Response,
    meta: { ipAddress: string | null; userAgent: string | null },
  ) {
    const email = sanitizeEmail(input.email);
    const code = sanitizeText(input.code, 6).toUpperCase();
    const user = await this.context.storage.findUserByEmail(email);

    if (!user) {
      throw new AppError(404, "Usuario no encontrado");
    }

    if (user.verified) {
      throw new AppError(400, "La cuenta ya está verificada");
    }

    if (!user.verificationCode || user.verificationCode !== code || !user.verificationExpiresAt || user.verificationExpiresAt < Date.now()) {
      throw new AppError(400, "Código inválido o expirado");
    }

    const verifiedUser = await this.context.storage.markUserVerified(email);
    if (!verifiedUser) {
      throw new AppError(404, "Usuario no encontrado");
    }

    const publicUser = toPublicUser(verifiedUser);
    const tokens = await createSessionTokens(this.context, publicUser, meta);
    applyRefreshCookie(this.context.config, response, tokens.refreshToken);

    return {
      token: tokens.accessToken,
      accessToken: tokens.accessToken,
      user: publicUser,
    };
  }

  /**
   * Renueva el access token a partir de una sesión válida.
   */
  async refreshSession(session: SessionRecord, response: Response) {
    const user = await this.context.storage.findUserById(session.userId);
    if (!user) {
      throw new AppError(401, "Usuario no encontrado");
    }

    const publicUser = toPublicUser(user);
    const accessToken = createAccessToken(this.context.config, {
      sub: publicUser.id,
      email: publicUser.email,
      username: publicUser.username,
      type: "access",
      sessionId: session.id,
    });

    return {
      token: accessToken,
      accessToken,
      user: publicUser,
    };
  }

  /**
   * Revoca la sesión actual y limpia la cookie.
   */
  async logout(sessionId: string | undefined, response: Response) {
    if (sessionId) {
      await this.context.storage.revokeSession(sessionId);
    }

    clearRefreshCookie(this.context.config, response);
    return {
      success: true,
    };
  }

  /**
   * Retorna el usuario autenticado.
   */
  async getCurrentUser(userId: string) {
    const user = await this.context.storage.findUserById(userId);
    if (!user) {
      throw new AppError(404, "Usuario no encontrado");
    }

    return {
      user: toPublicUser(user),
    };
  }

  /**
   * Actualiza el perfil autenticado validando unicidad.
   */
  async updateProfile(userId: string, input: { username?: string; email?: string }) {
    const username = input.username ? sanitizeUsername(input.username) : undefined;
    const email = input.email ? sanitizeEmail(input.email) : undefined;
    const current = await this.context.storage.findUserById(userId);

    if (!current) {
      throw new AppError(404, "Usuario no encontrado");
    }

    if (username && username !== current.username) {
      const existingUsername = await this.context.storage.findUserByUsername(username);
      if (existingUsername && existingUsername.id !== userId) {
        throw new AppError(409, "El nombre de usuario ya está en uso");
      }
    }

    if (email && email !== current.email) {
      const existingEmail = await this.context.storage.findUserByEmail(email);
      if (existingEmail && existingEmail.id !== userId) {
        throw new AppError(409, "El correo ya está registrado");
      }
    }

    const updated = await this.context.storage.updateUserProfile(userId, {
      username,
      email,
    });

    if (!updated) {
      throw new AppError(404, "Usuario no encontrado");
    }

    logger.info("Perfil actualizado", { userId, email: updated.email });
    return {
      user: toPublicUser(updated),
    };
  }

  /**
   * Construye metadatos de red seguros a partir del request.
   */
  static buildRequestMeta(input: { ip?: string; userAgent?: string | string[] | undefined }) {
    return {
      ipAddress: sanitizeIpAddress(input.ip),
      userAgent: sanitizeText(Array.isArray(input.userAgent) ? input.userAgent.join(", ") : input.userAgent, 300) || null,
    };
  }
}

