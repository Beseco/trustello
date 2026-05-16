export const TRUST_LEVEL_ORDER = [
  "NONE",
  "EMAIL",
  "SMS",
  "PIN_LETTER",
  "BAYERN_ID_S",
  "BAYERN_ID_H",
  "EID",
] as const;

export type TrustLevelString = (typeof TRUST_LEVEL_ORDER)[number];

export function meetsMinTrust(actual: TrustLevelString, required: TrustLevelString): boolean {
  return TRUST_LEVEL_ORDER.indexOf(actual) >= TRUST_LEVEL_ORDER.indexOf(required);
}
