import { sendVerificationEmail } from "../../src/lib/emailService.js";

/**
 * Envía el correo de verificación reutilizando la integración existente.
 */
export async function sendAccountVerificationEmail(email: string, verificationCode: string) {
  return sendVerificationEmail(email, verificationCode);
}

