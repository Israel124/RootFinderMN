import type { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import type { AppContext, AuthTokenPayload, AuthenticatedRequest } from "../types.js";
import { AppError } from "./errorHandler.js";
import { hashToken } from "../utils/crypto.js";

function parseCookies(headerValue: string | undefined): Record<string, string> {
  if (!headerValue) {
    return {};
  }

  return headerValue.split(";").reduce<Record<string, string>>((cookies, pair) => {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex <= 0) {
      return cookies;
    }

    const key = pair.slice(0, separatorIndex).trim();
    const value = decodeURIComponent(pair.slice(separatorIndex + 1).trim());
    cookies[key] = value;
    return cookies;
  }, {});
}

/**
 * Verifica el access token enviado por `Authorization: Bearer`.
 */
export function authenticateToken(context: AppContext) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

    if (!token) {
      next(new AppError(401, "Token de acceso requerido"));
      return;
    }

    try {
      const payload = jwt.verify(token, context.config.accessTokenSecret) as AuthTokenPayload;
      if (payload.type !== "access") {
        throw new AppError(401, "Tipo de token inválido");
      }

      req.auth = payload;
      next();
    } catch {
      next(new AppError(401, "Token inválido o expirado"));
    }
  };
}

/**
 * Verifica el refresh token persistido en cookie httpOnly.
 */
export function refreshToken(context: AppContext) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[context.config.refreshTokenCookieName];

    if (!token) {
      next(new AppError(401, "Refresh token requerido"));
      return;
    }

    const session = await context.storage.findSessionByTokenHash(hashToken(token));
    if (!session) {
      next(new AppError(401, "Sesión inválida"));
      return;
    }

    if (session.expiresAt <= Date.now()) {
      await context.storage.revokeSession(session.id);
      next(new AppError(401, "Sesión expirada"));
      return;
    }

    const user = await context.storage.findUserById(session.userId);
    if (!user) {
      await context.storage.revokeSession(session.id);
      next(new AppError(401, "Usuario no encontrado"));
      return;
    }

    req.session = session;
    req.auth = {
      sub: user.id,
      email: user.email,
      username: user.username,
      type: "access",
      sessionId: session.id,
    };

    next();
  };
}
