import { emailBase, emailDivider } from "./base";

type SmsQuotaWarningCustomerParams = {
  recipientName: string;
  tenantName: string;
  threshold: 80 | 90 | 100;
  used: number;
  quota: number;
};

type SmsQuotaWarningResellerParams = {
  customerName: string;
  customerEmail: string;
  tenantName: string;
  threshold: 80 | 90 | 100;
  used: number;
  quota: number;
};

function progressBar(pct: number): string {
  const color = pct >= 100 ? "#dc2626" : pct >= 90 ? "#f97316" : "#eab308";
  const width = Math.min(pct, 100);
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
    <tr>
      <td style="background-color:#f3f4f6;border-radius:4px;height:8px;overflow:hidden;">
        <table cellpadding="0" cellspacing="0" width="${width}%">
          <tr><td style="background-color:${color};height:8px;border-radius:4px;"></td></tr>
        </table>
      </td>
    </tr>
  </table>`;
}

/** E-Mail an den Kunden wenn sein SMS-Kontingent zu X % verbraucht ist */
export function smsQuotaWarningCustomerTemplate(p: SmsQuotaWarningCustomerParams): string {
  const pct = Math.round((p.used / p.quota) * 100);
  const isBlocked = p.threshold === 100;

  const statusColor = isBlocked ? "#dc2626" : p.threshold === 90 ? "#f97316" : "#eab308";
  const statusLabel = isBlocked ? "Kontingent erschöpft" : `${p.threshold} % verbraucht`;

  const content = `
    <p style="margin:0 0 16px;">Guten Tag ${p.recipientName},</p>
    <p style="margin:0 0 16px;">
      Ihr SMS-Kontingent für den aktuellen Monat bei <strong>${p.tenantName}</strong>
      ist zu <strong style="color:${statusColor};">${pct} %</strong> aufgebraucht.
    </p>

    <table width="100%" cellpadding="12" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin:16px 0;">
      <tr>
        <td>
          <p style="margin:0;font-size:13px;color:#6b7280;">SMS-Verbrauch diesen Monat</p>
          <p style="margin:4px 0 0;font-size:24px;font-weight:bold;color:#111827;">${p.used} / ${p.quota}</p>
          <p style="margin:2px 0 0;font-size:12px;color:${statusColor};font-weight:600;">${statusLabel}</p>
          ${progressBar(pct)}
        </td>
      </tr>
    </table>

    ${isBlocked ? `
    <p style="margin:16px 0;padding:12px 16px;background-color:#fef2f2;border-left:4px solid #dc2626;border-radius:0 4px 4px 0;font-size:13px;color:#dc2626;">
      <strong>Hinweis:</strong> Weitere SMS-Zustellungen für Ihre Nachrichten sind bis zum Monatsende ausgesetzt.
      Passwörter für gesicherte Nachrichten müssen in diesem Zeitraum auf anderem Weg übermittelt werden.
    </p>` : `
    <p style="margin:16px 0;font-size:14px;color:#374151;">
      Wenn das Kontingent vollständig aufgebraucht ist, können SMS-Passwörter für gesicherte Nachrichten
      nicht mehr automatisch zugestellt werden. Bitte wenden Sie sich bei Fragen an Ihren Ansprechpartner.
    </p>`}

    ${emailDivider()}
    <p style="margin:0;font-size:12px;color:#9ca3af;">Diese Benachrichtigung wurde automatisch versendet.</p>
  `;

  return emailBase({
    title: `SMS-Kontingent ${statusLabel} – ${p.tenantName}`,
    preheader: `Ihr SMS-Kontingent ist zu ${pct} % verbraucht (${p.used}/${p.quota} SMS).`,
    content,
  });
}

/** E-Mail an den Reseller-Admin wenn ein Kunde sein Kontingent überschreitet */
export function smsQuotaWarningResellerTemplate(p: SmsQuotaWarningResellerParams): string {
  const pct = Math.round((p.used / p.quota) * 100);
  const isBlocked = p.threshold === 100;
  const statusColor = isBlocked ? "#dc2626" : p.threshold === 90 ? "#f97316" : "#eab308";

  const content = `
    <p style="margin:0 0 16px;">SMS-Kontingent-Warnung:</p>

    <table width="100%" cellpadding="12" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin:16px 0;">
      <tr>
        <td>
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Kunde</p>
          <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${p.customerName}</p>
          <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">${p.customerEmail}</p>
          ${emailDivider()}
          <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Mandant</p>
          <p style="margin:0 0 12px;font-size:14px;color:#111827;">${p.tenantName}</p>
          <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">SMS-Verbrauch diesen Monat</p>
          <p style="margin:0;font-size:20px;font-weight:bold;color:#111827;">${p.used} / ${p.quota}</p>
          <p style="margin:2px 0 8px;font-size:12px;color:${statusColor};font-weight:600;">${pct} % verbraucht${isBlocked ? " – SMS gesperrt" : ""}</p>
          ${progressBar(pct)}
        </td>
      </tr>
    </table>

    ${isBlocked ? `<p style="margin:0;font-size:13px;color:#dc2626;font-weight:600;">Weitere SMS an diesen Kunden sind für diesen Monat gesperrt.</p>` : ""}
    <p style="margin:${isBlocked ? "8px" : "0"} 0 0;font-size:13px;color:#6b7280;">
      Das Kontingent kann im Reseller-Portal unter Einstellungen → SMS (sipgate) angepasst werden.
    </p>
  `;

  return emailBase({
    title: `SMS-Kontingent ${pct} % – ${p.customerName} (${p.tenantName})`,
    preheader: `Kunde ${p.customerName} hat ${pct} % seines SMS-Kontingents verbraucht.`,
    content,
  });
}
