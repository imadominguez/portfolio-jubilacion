import nodemailer from "nodemailer";

// Envío de mails por Gmail SMTP con una contraseña de aplicación (ADR-0020).
// Los timeouts cortos evitan que un SMTP colgado retenga el cron o la Server
// Action hasta el maxDuration (la misma regla que fetchWithTimeout).
const SMTP_TIMEOUT_MS = 15_000;

export function isMailerConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

export async function sendMail(message: { to: string; subject: string; text: string; html: string }): Promise<void> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error("Faltan GMAIL_USER y GMAIL_APP_PASSWORD para mandar mails.");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });

  await transporter.sendMail({ from: `"Portfolio Jubilación" <${user}>`, ...message });
}
