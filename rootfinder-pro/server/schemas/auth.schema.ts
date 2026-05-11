import { z } from "zod";

const sequentialPattern = /(\d)\1{3}/;
const consecutivePattern = /(0123|1234|2345|3456|4567|5678|6789|9876|8765|7654|6543|5432|4321|3210)/;

/**
 * Schema de registro de usuario.
 */
export const registerSchema = z
  .object({
    body: z
      .object({
        username: z.string().min(3).max(40).regex(/^[a-zA-Z0-9_.-]+$/, "Formato de usuario inválido"),
        email: z.string().email().max(100),
        password: z
          .string()
          .min(8)
          .max(100)
          .refine((password) => !sequentialPattern.test(password), "No secuencias repetidas")
          .refine((password) => !consecutivePattern.test(password), "No secuencias consecutivas"),
        confirmPassword: z.string(),
      })
      .refine((data) => data.password === data.confirmPassword, {
        message: "Las contraseñas no coinciden",
        path: ["confirmPassword"],
      }),
  })
  .strict();

/**
 * Schema de inicio de sesión.
 */
export const loginSchema = z
  .object({
    body: z.object({
      email: z.string().email().max(100),
      password: z.string().min(1).max(100),
    }),
  })
  .strict();

/**
 * Schema de verificación de cuenta.
 */
export const verifySchema = z
  .object({
    body: z.object({
      email: z.string().email().max(100),
      code: z.string().length(6).regex(/^[A-F0-9]{6}$/),
    }),
  })
  .strict();

/**
 * Schema para actualización de perfil.
 */
export const updateProfileSchema = z
  .object({
    body: z
      .object({
        username: z.string().min(3).max(40).regex(/^[a-zA-Z0-9_.-]+$/).optional(),
        email: z.string().email().max(100).optional(),
      })
      .refine((data) => Boolean(data.username || data.email), "Debes enviar al menos un campo"),
  })
  .strict();

