const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function emailBase({
  title,
  preheader,
  content,
}: {
  title: string;
  preheader?: string;
  content: string;
}): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${preheader ? `<span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>` : ""}
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background-color:#18181b;border-radius:8px 8px 0 0;padding:24px 40px;text-align:center;">
              <span style="font-size:20px;font-weight:bold;color:#ffffff;letter-spacing:-0.5px;">Trustello</span>
              <span style="font-size:11px;color:#a1a1aa;display:block;margin-top:2px;">Sicherer Datenaustausch</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:40px;border-left:1px solid #e4e4e7;border-right:1px solid #e4e4e7;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:14px;line-height:1.7;color:#374151;">
                    ${content}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;border:1px solid #e4e4e7;border-top:none;border-radius:0 0 8px 8px;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht auf diese Nachricht.<br>
                &copy; ${new Date().getFullYear()} Trustello &mdash; <a href="${APP_URL}" style="color:#6b7280;text-decoration:none;">trustello.de</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function emailButton(href: string, label: string, bgColor = "#18181b"): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:32px auto;">
    <tr>
      <td align="center" style="border-radius:6px;background-color:${bgColor};">
        <a href="${href}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

export function emailDivider(): string {
  return `<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;">`;
}
