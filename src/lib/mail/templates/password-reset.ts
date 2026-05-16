import { emailBase, emailButton, emailDivider } from "./base";

export function passwordResetTemplate({ resetUrl }: { resetUrl: string }): string {
  return emailBase({
    title: "Passwort zurücksetzen",
    content: `
      <p style="margin:0 0 16px">Sie haben angefordert, Ihr Passwort zurückzusetzen. Klicken Sie auf den folgenden Button, um ein neues Passwort zu vergeben.</p>
      ${emailButton(resetUrl, "Passwort zurücksetzen")}
      ${emailDivider()}
      <p style="margin:16px 0 0;color:#6b7280;font-size:13px">Der Link ist 1 Stunde gültig. Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.</p>
    `,
  });
}
