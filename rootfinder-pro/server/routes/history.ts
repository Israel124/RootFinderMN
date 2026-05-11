import { Router } from "express";
import type { AppContext, AuthenticatedRequest } from "../types.js";
import { authenticateToken } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authenticatedRateLimiter } from "../middleware/rateLimiter.js";
import { validate } from "../middleware/validate.js";
import { createHistorySchema, historyIdSchema, updateHistorySchema } from "../schemas/history.schema.js";
import { HistoryService } from "../services/historyService.js";

/**
 * Construye el router del historial.
 */
export function createHistoryRouter(context: AppContext): Router {
  const router = Router();
  const historyService = new HistoryService(context);

  router.use(authenticateToken(context));
  router.use(authenticatedRateLimiter);

  router.get(
    "/",
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const history = await historyService.listHistory(req.auth!.sub);
      res.json(history);
    }),
  );

  router.post(
    "/",
    validate(createHistorySchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const item = await historyService.saveHistory(req.auth!.sub, req.body);
      res.status(201).json({ success: true, item });
    }),
  );

  router.patch(
    "/:id",
    validate(updateHistorySchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const item = await historyService.updateHistory(req.auth!.sub, req.params.id, req.body as Record<string, unknown>);
      res.json({ success: true, item });
    }),
  );

  router.delete(
    "/:id",
    validate(historyIdSchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const result = await historyService.deleteHistory(req.auth!.sub, req.params.id);
      res.json(result);
    }),
  );

  router.delete(
    "/",
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const result = await historyService.clearHistory(req.auth!.sub);
      res.json(result);
    }),
  );

  return router;
}

