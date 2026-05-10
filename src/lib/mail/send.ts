import nodemailer from "nodemailer";
import { logger } from "@/lib/logger";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: false,
  ignoreTLS: true,
});

type MailOptions = {
  to: string;
  subject: string;
  html: string;
};

export async function sendMail(opts: MailOptions): Promise<void> {
  const from = process.env.SMTP_FROM ?? "noreply@trustello.local";
  try {
    await transporter.sendMail({ from, ...opts });
    logger.info({ to: opts.to, subject: opts.subject }, "Mail sent");
  } catch (err) {
    logger.error({ err, to: opts.to }, "Failed to send mail");
    throw err;
  }
}
