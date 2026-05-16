import { emailBase, emailButton, emailDivider } from "./base";

export function messageNotificationTemplate({
  recipientName,
  messageUrl,
  expiresAt,
  senderLabel,
  inviteUrl,
}: {
  recipientName: string;
  messageUrl: string;
  expiresAt: Date;
  senderLabel?: string;
  inviteUrl?: string;
}): string {
  const expiresStr = expiresAt.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const senderBlock = senderLabel
    ? `<p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Von:</p>
       <p style="margin:0 0 20px;font-size:14px;font-weight:600;color:#374151;">${senderLabel}</p>`
    : "";

  const inviteBlock = inviteUrl
    ? `${emailDivider()}
       <p style="margin:0 0 12px;font-size:14px;color:#374151;font-weight:600;">
         Ihr sicheres Postfach
       </p>
       <p style="margin:0 0 16px;font-size:13px;color:#6b7280;">
         Richten Sie Ihr persönliches Bürger-Postfach ein — alle Nachrichten von Behörden
         an einem Ort, mit Ende-zu-Ende-Verschlüsselung.
       </p>
       ${emailButton(inviteUrl, "Postfach jetzt einrichten", "#059669")}`
    : "";

  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;">Neue sichere Nachricht</h2>
    <p style="margin:0 0 16px;">Guten Tag ${recipientName},</p>
    ${senderBlock}
    <p style="margin:0 0 20px;font-size:14px;color:#374151;">
      Sie haben eine neue sichere Nachricht erhalten.
      Die Nachricht ist bis zum <strong>${expiresStr}</strong> abrufbar.
    </p>
    ${emailButton(messageUrl, "Nachricht jetzt lesen")}
    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">
      ⚠ Bitte leiten Sie diese E-Mail nicht weiter — der Link ist personalisiert und öffnet Ihre persönliche Nachricht.
    </p>
    ${inviteBlock}
    ${emailDivider()}
    <p style="margin:0;font-size:12px;color:#9ca3af;">
      Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br>
      <a href="${messageUrl}" style="color:#6b7280;word-break:break-all;">${messageUrl}</a>
    </p>
  `;

  return emailBase({
    title: "Neue sichere Nachricht — Trustello",
    preheader: `Neue Nachricht von ${senderLabel ?? "einer Behörde"} (abrufbar bis ${expiresStr}).`,
    content,
  });
}
