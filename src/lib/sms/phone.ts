/**
 * Telefonnummer-Hilfsfunktionen — browser-kompatibel (kein Node.js API).
 * Kann in Client- und Server-Komponenten importiert werden.
 */

/**
 * Formatiert Telefonnummern nach E.164.
 *   +49151...   → bleibt (bereits E.164)
 *   0049151...  → +49151...
 *   0151...     → +49151... (deutsche Nummer)
 * Gibt null zurück bei unbekanntem Format.
 */
export function formatPhoneE164(raw: string): string | null {
  const digits = raw.replace(/[\s\-\(\)\/\.]/g, "");
  if (/^\+\d{7,15}$/.test(digits)) return digits;
  if (/^00\d{7,15}$/.test(digits)) return "+" + digits.slice(2);
  if (/^0\d{6,14}$/.test(digits)) return "+49" + digits.slice(1);
  return null;
}

/**
 * Maskiert eine Telefonnummer für die Anzeige.
 * "+4915112345678" → "+49 *** ***5678"
 */
export function formatPhoneDisplay(raw: string): string {
  const e164 = formatPhoneE164(raw);
  const num = e164 ?? raw;
  if (num.length <= 4) return "***";
  return num.slice(0, 3) + " *** ***" + num.slice(-4);
}

/**
 * Gibt den aktuellen Monat als YYYYMM-Zahl zurück.
 * z.B. Januar 2026 → 202601
 */
export function getCurrentMonth(): number {
  const now = new Date();
  return now.getFullYear() * 100 + (now.getMonth() + 1);
}
