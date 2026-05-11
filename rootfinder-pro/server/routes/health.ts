import { Router } from "express";
import type { AppContext } from "../types.js";

/**
 * Construye el router de salud del backend.
 */
export function createHealthRouter(context: AppContext): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    const storageSnapshot = await context.storage.getHealthSnapshot();
    const memoryMB = Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100;
    const uptime = Math.round(process.uptime() * 100) / 100;

    const status =
      storageSnapshot.status === "ok" ? "ok" : storageSnapshot.status === "error" ? "error" : "degraded";

    res.status(status === "error" ? 503 : 200).json({
      status,
      storage: context.storage.mode,
      dbLatencyMs: storageSnapshot.dbLatencyMs,
      uptime,
      memoryMB,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

