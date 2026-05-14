import express from "express";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import type { AddressInfo } from "net";
import { createAuthRouter } from "./server/routes/auth.js";
import { createHealthRouter } from "./server/routes/health.js";
import { createHistoryRouter } from "./server/routes/history.js";
import { createUserRouter } from "./server/routes/user.js";
import { errorHandler, notFoundHandler } from "./server/middleware/errorHandler.js";
import { createStorage } from "./server/storage/index.js";
import { logger } from "./server/utils/logger.js";
import type { AppConfig, AppContext } from "./server/types.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Carga la configuración del backend con valores por defecto seguros.
 */
export function loadConfig(): AppConfig {
  const appOrigin = process.env.APP_ORIGIN || "http://localhost:4000";
  const corsOrigins = (
    process.env.CORS_ORIGINS || 
    `${appOrigin},http://localhost:5173,http://127.0.0.1:5173,http://localhost:4001,http://127.0.0.1:4001,http://localhost:4000,http://localhost:4003`
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    port: Number(process.env.PORT) || 4000,
    host: process.env.HOST || "0.0.0.0",
    nodeEnv: process.env.NODE_ENV || "development",
    appOrigin,
    corsOrigins,
    accessTokenSecret: process.env.JWT_SECRET || "change-this-secret-in-production",
    refreshTokenCookieName: process.env.REFRESH_COOKIE_NAME || "rf_refresh_token",
    accessTokenTtlMs: 15 * 60 * 1000,
    refreshTokenTtlMs: 7 * 24 * 60 * 60 * 1000,
    dataDirectory: path.join(__dirname, "data"),
    usersFile: path.join(__dirname, "users.json"),
    historyFile: path.join(__dirname, "history.json"),
    sessionsFile: path.join(__dirname, "sessions.json"),
  };
}

/**
 * Aplica headers de seguridad equivalentes a una política endurecida.
 */
function applySecurityHeaders(app: express.Express) {
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.geogebra.org https://geogebra.org; style-src 'self' 'unsafe-inline' https://www.geogebra.org https://geogebra.org; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https: http:; frame-src 'self' https://www.geogebra.org https://geogebra.org; child-src 'self' https://www.geogebra.org https://geogebra.org; worker-src 'self' blob: https://www.geogebra.org https://geogebra.org; object-src 'none'; frame-ancestors 'none'; base-uri 'self';",
    );

    if (req.secure || process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    next();
  });
}

/**
 * Aplica una política CORS explícita sin comodines en producción.
 */
function applyCorsPolicy(app: express.Express, config: AppConfig) {
  app.use((req, res, next) => {
    const requestOrigin = req.headers.origin;

    if (requestOrigin && config.corsOrigins.includes(requestOrigin)) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }

    if (req.method === "OPTIONS") {
      res.sendStatus(requestOrigin ? 204 : 200);
      return;
    }

    if (requestOrigin && !config.corsOrigins.includes(requestOrigin)) {
      res.status(403).json({ error: "Origen no permitido por CORS" });
      return;
    }

    next();
  });
}

/**
 * Crea la aplicación Express principal.
 */
export async function createApp(options?: { serveFrontend?: boolean }) {
  const config = loadConfig();
  const storage = createStorage(config);
  await storage.init();

  const context: AppContext = {
    storage,
    config,
  };

  const app = express();
  app.set("trust proxy", 1);

  applySecurityHeaders(app);
  applyCorsPolicy(app, config);
  app.use(express.json({ limit: "200kb" }));
  app.use(express.urlencoded({ extended: false, limit: "200kb" }));

  const authRouter = createAuthRouter(context);
  const historyRouter = createHistoryRouter(context);
  const userRouter = createUserRouter(context);
  const healthRouter = createHealthRouter(context);

  app.use("/api/auth", authRouter);
  app.use("/api", authRouter);
  app.use("/api/history", historyRouter);
  app.use("/api/user", userRouter);
  app.use("/api", userRouter);
  app.use("/api/health", healthRouter);
  app.use("/health", healthRouter);

  if (options?.serveFrontend !== false) {
    if (config.nodeEnv !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: false },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use("/RootFinderMN", express.static(distPath));
      app.use(express.static(distPath));
      app.get("/RootFinderMN", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
      app.get("/RootFinderMN/*", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
      app.get("*", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, context };
}

/**
 * Inicia el servidor HTTP con reintento básico de puertos.
 */
export async function startServer(options?: { serveFrontend?: boolean }) {
  const { app, context } = await createApp(options);
  const preferredPort = context.config.port;
  const host = context.config.host;
  const maxPortAttempts = 10;

  return await new Promise<void>((resolve, reject) => {
    const listenOnPort = (port: number, attemptsLeft: number) => {
      const server = app.listen(port, host, () => {
        const address = server.address() as AddressInfo | null;
        const activePort = address?.port ?? port;
        logger.info("Servidor iniciado", {
          host,
          port: activePort,
          storage: context.storage.mode,
          frontend: options?.serveFrontend !== false,
        });
        resolve();
      });

      server.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE" && attemptsLeft > 0) {
          listenOnPort(port + 1, attemptsLeft - 1);
          return;
        }

        reject(error);
      });
    };

    listenOnPort(preferredPort, maxPortAttempts);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void startServer().catch((error) => {
    logger.error("No se pudo iniciar el servidor", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  });
}
