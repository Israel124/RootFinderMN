import { createHash, randomBytes, timingSafeEqual } from "crypto";

/**
 * Genera un código hexadecimal seguro de seis caracteres para verificación.
 */
export function generateVerificationCode(): string {
  return randomBytes(3).toString("hex").toUpperCase();
}

/**
 * Genera un token aleatorio suficientemente fuerte para refresh tokens.
 */
export function generateRefreshToken(): string {
  return randomBytes(48).toString("hex");
}

/**
 * Calcula un hash determinístico para persistir tokens sin guardar el valor original.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Compara dos cadenas en tiempo constante cuando tienen el mismo tamaño.
 */
export function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

