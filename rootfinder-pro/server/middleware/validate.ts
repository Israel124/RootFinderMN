import type { RequestHandler } from "express";
import { z, type AnyZodObject, type ZodTypeAny } from "zod";

function pickRequestShape(schema: AnyZodObject | ZodTypeAny, req: Parameters<RequestHandler>[0]) {
  if (!(schema instanceof z.ZodObject)) {
    return {
      body: req.body,
      params: req.params,
      query: req.query,
    };
  }

  const shape = schema.shape;
  const payload: Record<string, unknown> = {};

  if ("body" in shape) {
    payload.body = req.body;
  }

  if ("params" in shape) {
    payload.params = req.params;
  }

  if ("query" in shape) {
    payload.query = req.query;
  }

  return payload;
}

/**
 * Valida `body`, `params` y `query` con Zod y reemplaza el request por la versión parseada.
 */
export function validate(schema: AnyZodObject | ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.parse(pickRequestShape(schema, req)) as {
      body?: unknown;
      params?: unknown;
      query?: unknown;
    };

    if (parsed.body !== undefined) {
      req.body = parsed.body;
    }

    if (parsed.params !== undefined) {
      req.params = parsed.params as typeof req.params;
    }

    if (parsed.query !== undefined) {
      req.query = parsed.query as typeof req.query;
    }

    next();
  };
}
