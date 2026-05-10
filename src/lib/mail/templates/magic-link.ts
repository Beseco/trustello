// Phase 2: Bürger-Portal Magic-Link
export function magicLinkTemplate(link: string): string {
  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Ihr sicherer Zugangslink</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="font-size: 24px; font-weight: bold; color: #111;">Trustello</h1>
  </div>
  <p>Sie haben eine neue sichere Nachricht erhalten.</p>
  <p>Klicken Sie auf den folgenden Link, um Ihre Nachricht abzurufen:</p>
  <div style="margin: 32px 0; text-align: center;">
    <a
      href="${link}"
      style="background-color: #18181b; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px;"
    >
      Nachricht abrufen
    </a>
  </div>
  <p style="font-size: 12px; color: #666;">
    Dieser Link ist 72 Stunden gültig und kann nur einmal verwendet werden.<br>
    Wenn Sie diese E-Mail nicht erwartet haben, können Sie sie ignorieren.
  </p>
</body>
</html>
  `.trim();
}
