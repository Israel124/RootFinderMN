import { z } from "zod";
import { ALLOWED_METHODS } from "../utils/sanitize.js";

const scalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const jsonValueSchema: z.ZodTypeAny = z.lazy(() =>
  z.union([scalarSchema, z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)]),
);

const jsonRecordSchema = z.record(z.string(), jsonValueSchema);

const calculationSchema = z.object({
  id: z.string().min(1).max(80),
  timestamp: z.number().finite().optional(),
  method: z.string().refine((method) => ALLOWED_METHODS.has(method), "Método inválido"),
  functionF: z.string().min(1).max(2000).optional(),
  functionF1: z.string().min(1).max(2000).optional(),
  fx: z.string().min(1).max(2000).optional(),
  functionG: z.string().max(2000).optional().nullable(),
  functionF2: z.string().max(2000).optional().nullable(),
  root: z.number().finite().nullable().optional(),
  error: z.number().finite().nullable().optional(),
  iterations: z.array(jsonRecordSchema).max(500).default([]),
  converged: z.boolean().default(false),
  message: z.string().max(1200).default(""),
  params: jsonRecordSchema.default({}),
  label: z.string().max(200).nullable().optional(),
  solution: z.record(z.string(), z.number().finite()).optional(),
});

/**
 * Schema para crear o reemplazar un cálculo del historial.
 */
export const createHistorySchema = z
  .object({
    body: calculationSchema.refine((data) => Boolean(data.functionF || data.functionF1 || data.fx), {
      message: "La función principal es requerida",
      path: ["functionF"],
    }),
  })
  .strict();

/**
 * Schema para actualizar un cálculo o solamente su etiqueta.
 */
export const updateHistorySchema = z
  .object({
    params: z.object({
      id: z.string().min(1).max(80),
    }),
    body: calculationSchema
      .partial()
      .extend({
        label: z.string().max(200).nullable().optional(),
      })
      .refine((data) => Object.keys(data).length > 0, "No hay datos para actualizar"),
  })
  .strict();

/**
 * Schema para operaciones por id del historial.
 */
export const historyIdSchema = z
  .object({
    params: z.object({
      id: z.string().min(1).max(80),
    }),
  })
  .strict();

