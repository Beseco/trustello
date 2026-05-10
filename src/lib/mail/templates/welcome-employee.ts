export function welcomeEmployeeTemplate(name: string): string {
  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Willkommen bei Trustello</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="font-size: 24px; font-weight: bold; color: #111;">Trustello</h1>
  </div>
  <p>Guten Tag ${name},</p>
  <p>Ihr Konto wurde erfolgreich angelegt. Sie können sich ab sofort mit Ihrer E-Mail-Adresse und Ihrem Passwort anmelden.</p>
  <div style="margin: 32px 0; text-align: center;">
    <a
      href="${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/login"
      style="background-color: #18181b; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px;"
    >
      Jetzt anmelden
    </a>
  </div>
  <p style="font-size: 12px; color: #666;">
    Diese E-Mail wurde automatisch versandt. Bitte antworten Sie nicht auf diese E-Mail.
  </p>
</body>
</html>
  `.trim();
}
