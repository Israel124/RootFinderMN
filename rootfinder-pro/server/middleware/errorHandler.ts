import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../utils/logger.js";

/**
 * Error de aplicación con semántica HTTP conocida.
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;

  constructor(statusCode: number, message: string, isOperational = true, code?: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
  }
}

/**
 * Wrapper para handlers async y propagación al middleware central.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}

/**
 * Convierte rutas desconocidas en un error HTTP consistente.
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

/**
 * Formatea cualquier error del backend en una respuesta segura para el cliente.
 */
export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    const issues = error.issues.map((issue) => issue.message).join(", ");
    res.status(400).json({
      error: "Solicitud inválida",
      details: issues,
    });
    return;
  }

  if (error instanceof AppError) {
    if (!error.isOperational) {
      logger.error("Error no operacional", {
        path: req.originalUrl,
        method: req.method,
        error: error.message,
        code: error.code,
      });
    }

    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
    });
    return;
  }

  const unexpected = error instanceof Error ? error : new Error("Error desconocido");
  logger.error("Error inesperado del servidor", {
    path: req.originalUrl,
    method: req.method,
    error: unexpected.message,
    stack: unexpected.stack,
  });

  res.status(500).json({
    error: "Error interno del servidor",
  });
}

