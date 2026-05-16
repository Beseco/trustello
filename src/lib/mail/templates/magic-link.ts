import { emailBase, emailButton, emailDivider } from "./base";

export function magicLinkTemplate(link: string): string {
  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;">Sie haben eine neue Nachricht</h2>
    <p style="margin:0 0 16px;">
      Eine Behörde hat Ihnen eine sichere Nachricht über Trustello zugesandt.
      Klicken Sie auf den Button, um Ihre Nachricht sicher abzurufen.
    </p>
    ${emailButton(link, "Nachricht abrufen")}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td style="background-color:#fefce8;border:1px solid #fde68a;border-radius:6px;padding:12px 16px;">
          <p style="margin:0;font-size:13px;color:#92400e;">
            <strong>Hinweis:</strong> Dieser Link ist <strong>72 Stunden</strong> gültig und kann nur einmal verwendet werden.
            Teilen Sie diesen Link mit niemandem.
          </p>
        </td>
      </tr>
    </table>
    ${emailDivider()}
    <p style="margin:0;font-size:12px;color:#9ca3af;">
      Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br>
      <a href="${link}" style="color:#6b7280;word-break:break-all;">${link}</a>
    </p>
    <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">
      Wenn Sie diese E-Mail nicht erwartet haben, können Sie sie ignorieren.
    </p>
  `;

  return emailBase({
    title: "Neue sichere Nachricht — Trustello",
    preheader: "Sie haben eine neue sichere Nachricht erhalten.",
    content,
  });
}
