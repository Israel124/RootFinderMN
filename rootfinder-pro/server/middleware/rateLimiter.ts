import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const defaultMessage = {
  error: "Demasiados intentos. Intenta nuevamente más tarde.",
};

/**
 * Limita intentos de login por IP.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos de inicio de sesión. Espera 15 minutos.",
  },
});

/**
 * Limita registros por IP.
 */
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiados registros desde esta IP. Espera una hora.",
  },
});

/**
 * Limita operaciones autenticadas sensibles por usuario o IP.
 */
export const authenticatedRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = (req as { auth?: { sub?: string } }).auth?.sub;
    return userId ?? ipKeyGenerator(req.ip ?? "127.0.0.1");
  },
  message: defaultMessage,
});
