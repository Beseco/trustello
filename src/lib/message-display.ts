/**
 * Hilfsfunktionen für die Nachrichten-Anzeige im Bürger-Postfach.
 */

type MessageWithDisplayInfo = {
  senderIsAnonymous: boolean;
  sender: { firstName: string; lastName: string };
  ou: { name: string } | null;
  tenant: { name: string };
};

/**
 * Gibt den Absender-Label für die Postfach-Anzeige zurück.
 * Wenn senderIsAnonymous=true: "Mitarbeiter/in · OU · Mandant"
 * Sonst:                       "Vorname Nachname · OU · Mandant"
 */
export function resolveSenderLabel(message: MessageWithDisplayInfo): string {
  const tenantName = message.tenant.name;
  const ouName = message.ou?.name;

  if (message.senderIsAnonymous) {
    return ouName
      ? `Mitarbeiter/in · ${ouName} · ${tenantName}`
      : `Mitarbeiter/in · ${tenantName}`;
  }

  const name = `${message.sender.firstName} ${message.sender.lastName}`.trim();
  return ouName ? `${name} · ${ouName} · ${tenantName}` : `${name} · ${tenantName}`;
}

/**
 * Gibt die Sicherheitsstufen-Beschriftung zurück.
 */
export function securityLevelLabel(level: string): string {
  const labels: Record<string, string> = {
    LEVEL_1: "Standard",
    LEVEL_2: "Verschlüsselt",
    LEVEL_3: "Passwortgeschützt",
    LEVEL_4: "Höchste Sicherheit",
  };
  return labels[level] ?? level;
}
