import { emailBase } from "./base";

export function readReceiptTemplate({
  recipientName,
  subject,
  readAt,
}: {
  recipientName: string;
  subject: string;
  readAt: Date;
}): string {
  const dateStr = readAt.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return emailBase({
    title: "Nachricht wurde geöffnet",
    content: `
      <p style="margin:0 0 16px">Ihre Nachricht wurde geöffnet:</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 16px;">
        <tr>
          <td style="padding:8px 12px;background:#f4f4f5;border-radius:4px 4px 0 0;font-size:13px;color:#6b7280;width:130px;">Empfänger</td>
          <td style="padding:8px 12px;background:#f4f4f5;border-radius:4px 4px 0 0;font-size:13px;font-weight:600;">${recipientName}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#fafafa;font-size:13px;color:#6b7280;">Betreff</td>
          <td style="padding:8px 12px;background:#fafafa;font-size:13px;">${subject}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f4f4f5;border-radius:0 0 4px 4px;font-size:13px;color:#6b7280;">Geöffnet am</td>
          <td style="padding:8px 12px;background:#f4f4f5;border-radius:0 0 4px 4px;font-size:13px;">${dateStr} Uhr</td>
        </tr>
      </table>
      <p style="margin:0;color:#6b7280;font-size:13px;">Dies ist eine automatische Benachrichtigung von Trustello.</p>
    `,
  });
}
