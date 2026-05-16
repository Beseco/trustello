import { emailBase, emailButton, emailDivider } from "./base";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function welcomeEmployeeTemplate({
  name,
  email,
  tempPassword,
}: {
  name: string;
  email: string;
  tempPassword?: string;
}): string {
  const isInvite = !!tempPassword;

  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;">
      ${isInvite ? "Sie wurden eingeladen" : "Willkommen bei Trustello"}
    </h2>
    <p style="margin:0 0 12px;">Guten Tag ${name},</p>
    <p style="margin:0 0 20px;">
      ${
        isInvite
          ? "Ihr Mitarbeiterkonto bei Trustello wurde eingerichtet. Sie können sich ab sofort anmelden."
          : "Ihr Konto wurde erfolgreich angelegt. Sie können sich ab sofort anmelden."
      }
    </p>
    ${
      isInvite && tempPassword
        ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
            <tr>
              <td style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Ihre Zugangsdaten</p>
                <p style="margin:0 0 4px;font-size:14px;"><strong>E-Mail:</strong> ${email}</p>
                <p style="margin:0;font-size:14px;"><strong>Temporäres Passwort:</strong> <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:monospace;">${tempPassword}</code></p>
              </td>
            </tr>
          </table>
          <p style="margin:0 0 20px;font-size:13px;color:#6b7280;">
            Bitte ändern Sie Ihr Passwort nach der ersten Anmeldung unter <strong>Mein Konto → Passwort ändern</strong>.
          </p>`
        : ""
    }
    ${emailButton(`${APP_URL}/login`, "Jetzt anmelden")}
    ${emailDivider()}
    <p style="margin:0;font-size:12px;color:#9ca3af;">
      Bei Fragen wenden Sie sich an Ihren Administrator.
    </p>
  `;

  return emailBase({
    title: isInvite ? "Einladung zu Trustello" : "Willkommen bei Trustello",
    preheader: isInvite
      ? "Ihr Trustello-Konto wurde eingerichtet."
      : "Ihr Konto wurde erfolgreich angelegt.",
    content,
  });
}
