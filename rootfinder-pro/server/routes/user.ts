import { Router } from "express";
import type { AppContext, AuthenticatedRequest } from "../types.js";
import { authenticateToken } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authenticatedRateLimiter } from "../middleware/rateLimiter.js";
import { validate } from "../middleware/validate.js";
import { updateProfileSchema } from "../schemas/auth.schema.js";
import { AuthService } from "../services/authService.js";

/**
 * Construye el router de usuario actual.
 */
export function createUserRouter(context: AppContext): Router {
  const router = Router();
  const authService = new AuthService(context);

  router.use(authenticateToken(context));
  router.use(authenticatedRateLimiter);

  router.get(
    "/me",
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const result = await authService.getCurrentUser(req.auth!.sub);
      res.json(result);
    }),
  );

  router.patch(
    "/me",
    validate(updateProfileSchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const result = await authService.updateProfile(req.auth!.sub, req.body);
      res.json(result);
    }),
  );

  return router;
}

