function getBrevoFriendlyError(status: number, rawText: string) {
  let message = rawText.trim();

  try {
    const parsed = JSON.parse(rawText) as { message?: string; code?: string };
    if (parsed.message) {
      message = parsed.message;
    }
  } catch {
    // Keep the raw response when Brevo does not return JSON.
  }

  const normalized = message.toLowerCase();

  if (status === 401 && normalized.includes("unrecognised ip address")) {
    return "Brevo bloqueó el envío porque la IP pública del servidor no está autorizada en tu cuenta. Agrega esa IP en Brevo > Security > Authorised IPs.";
  }

  if (status === 401) {
    return "Brevo rechazó la autenticación. Revisa que `BREVO_API_KEY` sea válida y que la cuenta permita envíos desde este entorno.";
  }

  if (status === 400 && normalized.includes("sender")) {
    return "Brevo rechazó el remitente. Verifica que `BREVO_SENDER_EMAIL` esté validado dentro de tu cuenta de Brevo.";
  }

  return `Brevo error ${status}: ${message}`;
}

export async function sendVerificationEmail(email: string, verificationCode: string) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@rootfinderpro.com';
  const isDev = process.env.NODE_ENV !== 'production';
  
  // Allow development mode with fake keys
  if (!apiKey || (isDev && (apiKey === 'fake-key-for-development' || apiKey.startsWith('fake')))) {
    console.log(`[DEV] Verification email for ${email}: ${verificationCode}`);
    return { success: true };
  }

  if (!apiKey) {
    console.error('BREVO_API_KEY not set');
    return { success: false, error: 'BREVO_API_KEY not set' };
  }

  const data = {
    sender: { name: "RootFinder", email: senderEmail },
    to: [{ email }],
    subject: "Verifica tu cuenta - RootFinder",
    htmlContent: `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verifica tu cuenta</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 0;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .content {
            padding: 40px 30px;
            text-align: center;
          }
          .code {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: white;
            font-size: 32px;
            font-weight: bold;
            padding: 20px;
            border-radius: 15px;
            margin: 30px 0;
            letter-spacing: 4px;
            display: inline-block;
          }
          .footer {
            background: #f8fafc;
            padding: 30px;
            text-align: center;
            color: #64748b;
            font-size: 14px;
          }
          .warning {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>RootFinder</h1>
            <p>Verificación de cuenta</p>
          </div>
          <div class="content">
            <h2>¡Bienvenido al laboratorio de raíces!</h2>
            <p>Para completar tu registro y acceder a todas las funcionalidades de análisis numérico, verifica tu correo electrónico con el siguiente código:</p>
            <div class="code">${verificationCode}</div>
            <p>Ingresa este código en la aplicación para activar tu cuenta.</p>
            <div class="warning">
              <strong>⚠️ Importante:</strong> Este código expira en 24 horas.
            </div>
            <p>¿Listo para dominar ecuaciones no lineales?</p>
          </div>
          <div class="footer">
            <p>Si no solicitaste esta verificación, ignora este mensaje.</p>
            <p>&copy; 2026 RootFinder</p>
          </div>
        </div>
      </body>
      </html>
    `,
    replyTo: { email: senderEmail }
  };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify(data)
    });

    const text = await response.text();
    if (response.ok) {
      console.log('Email sent successfully to', email);
      return { success: true };
    }

    console.error('Brevo send failed:', response.status, response.statusText, text);
    return { success: false, error: getBrevoFriendlyError(response.status, text) };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
