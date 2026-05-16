/** Löst Platzhalter im Signatur-Template auf */
export function resolveSignature(
  template: string,
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    position?: string | null;
  },
): string {
  return template
    .replace(/\{\{vorname\}\}/gi, user.firstName)
    .replace(/\{\{nachname\}\}/gi, user.lastName)
    .replace(/\{\{name\}\}/gi, `${user.firstName} ${user.lastName}`)
    .replace(/\{\{email\}\}/gi, user.email)
    .replace(/\{\{telefon\}\}/gi, user.phone ?? "")
    .replace(/\{\{position\}\}/gi, user.position ?? "");
}
