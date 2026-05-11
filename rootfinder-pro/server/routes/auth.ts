import { Router } from "express";
import type { AppContext, AuthenticatedRequest } from "../types.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { loginRateLimiter, registerRateLimiter } from "../middleware/rateLimiter.js";
import { validate } from "../middleware/validate.js";
import { loginSchema, registerSchema, verifySchema } from "../schemas/auth.schema.js";
import { AuthService } from "../services/authService.js";
import { refreshToken } from "../middleware/auth.js";

/**
 * Construye el router de autenticación.
 */
export function createAuthRouter(context: AppContext): Router {
  const router = Router();
  const authService = new AuthService(context);

  router.post(
    "/register",
    registerRateLimiter,
    validate(registerSchema),
    asyncHandler(async (req, res) => {
      const result = await authService.register(req.body, res);
      res.status(201).json(result);
    }),
  );

  router.post(
    "/login",
    loginRateLimiter,
    validate(loginSchema),
    asyncHandler(async (req, res) => {
      const meta = AuthService.buildRequestMeta({
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      const result = await authService.login(req.body, res, meta);

      if ("requiresVerification" in result) {
        res.status(403).json(result);
        return;
      }

      res.json(result);
    }),
  );

  router.post(
    "/verify",
    validate(verifySchema),
    asyncHandler(async (req, res) => {
      const meta = AuthService.buildRequestMeta({
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      const result = await authService.verifyEmail(req.body, res, meta);
      res.json(result);
    }),
  );

  router.post(
    "/refresh",
    refreshToken(context),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const result = await authService.refreshSession(req.session!, res);
      res.json(result);
    }),
  );

  router.post(
    "/logout",
    refreshToken(context),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const result = await authService.logout(req.session?.id, res);
      res.json(result);
    }),
  );

  return router;
}

