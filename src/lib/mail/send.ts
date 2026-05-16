import { logger } from "@/lib/logger";
import { resolveSmtpTransporter } from "./smtp";

type MailOptions = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Sendet eine E-Mail.
 *
 * @param opts       Empfänger, Betreff und HTML-Inhalt
 * @param tenantId   Optional: Tenant-ID → SMTP-Lookup (Tenant → Reseller → Env)
 * @param resellerId Optional: direkt per Reseller-ID (z.B. für Reseller-eigene Mails ohne Tenant-Kontext)
 */
export async function sendMail(opts: MailOptions, tenantId?: string, resellerId?: string): Promise<void> {
  const { transporter, from, source } = await resolveSmtpTransporter(tenantId, resellerId);

  try {
    await transporter.sendMail({ from, ...opts });
    logger.info({ to: opts.to, subject: opts.subject, smtpSource: source }, "Mail sent");
  } catch (err) {
    logger.error({ err, to: opts.to, smtpSource: source }, "Failed to send mail");
    throw err;
  }
}
