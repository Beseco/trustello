import { emailBase, emailButton, emailDivider } from "./base";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function citizenReplyNotificationTemplate({
  employeeName,
  customerName,
  originalMessageId,
}: {
  employeeName: string;
  customerName: string;
  originalMessageId: string;
}): string {
  const messageUrl = `${APP_URL}/inbox/${originalMessageId}`;

  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;">Neue Antwort eingegangen</h2>
    <p style="margin:0 0 16px;">Guten Tag ${employeeName},</p>
    <p style="margin:0 0 20px;">
      <strong>${customerName}</strong> hat auf Ihre Nachricht geantwortet.
      Die Antwort finden Sie in Ihrem Postausgang.
    </p>
    ${emailButton(messageUrl, "Antwort anzeigen")}
    ${emailDivider()}
    <p style="margin:0;font-size:12px;color:#9ca3af;">
      Falls der Button nicht funktioniert:<br>
      <a href="${messageUrl}" style="color:#6b7280;word-break:break-all;">${messageUrl}</a>
    </p>
  `;

  return emailBase({
    title: "Neue Bürger-Antwort — Trustello",
    preheader: `${customerName} hat auf Ihre Nachricht geantwortet.`,
    content,
  });
}
