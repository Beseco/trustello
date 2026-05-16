import { formatPhoneE164 } from "./phone";
import { encrypt, decrypt } from "@/lib/crypto/envelope";

const SIPGATE_API = "https://api.sipgate.com/v2/sessions/sms";

export interface SmsResult {
  ok: boolean;
  error?: string;
}

// ── Verschlüsselung ────────────────────────────────────────────────────────────

function getMasterKey(): Buffer {
  const key = process.env.MASTER_KEY;
  if (!key) throw new Error("MASTER_KEY not set");
  return Buffer.from(key, "base64");
}

function toUint8Array(source: Buffer | Uint8Array): Uint8Array<ArrayBuffer> {
  const ab = new ArrayBuffer(source.length);
  new Uint8Array(ab).set(source);
  return new Uint8Array(ab);
}

export function encryptSipgateToken(token: string): {
  tokenEnc: Uint8Array<ArrayBuffer>;
  tokenIv: Uint8Array<ArrayBuffer>;
  tokenTag: Uint8Array<ArrayBuffer>;
} {
  const { ciphertext, iv, authTag } = encrypt(Buffer.from(token, "utf-8"), getMasterKey());
  return {
    tokenEnc: toUint8Array(Buffer.from(ciphertext)),
    tokenIv: toUint8Array(Buffer.from(iv)),
    tokenTag: toUint8Array(Buffer.from(authTag)),
  };
}

export function decryptSipgateToken(config: {
  tokenEnc: Uint8Array | Buffer;
  tokenIv: Uint8Array | Buffer;
  tokenTag: Uint8Array | Buffer;
}): string | null {
  try {
    return decrypt(
      {
        ciphertext: Buffer.from(config.tokenEnc),
        iv: Buffer.from(config.tokenIv),
        authTag: Buffer.from(config.tokenTag),
      },
      getMasterKey(),
    ).toString("utf-8");
  } catch {
    return null;
  }
}

// ── Credentials-Resolver: DB → Env ─────────────────────────────────────────────

type SipgateCredentials = {
  tokenId: string;
  token: string;
  smsId: string;
};

async function resolveCredentials(resellerId?: string): Promise<SipgateCredentials | null> {
  if (resellerId) {
    // Lazy import, um zirkuläre Abhängigkeiten mit Prisma zu vermeiden
    const { prisma } = await import("@/lib/db");
    const config = await prisma.sipgateConfig.findUnique({ where: { resellerId } });
    if (config) {
      const token = decryptSipgateToken({
        tokenEnc: Buffer.from(config.tokenEnc),
        tokenIv: Buffer.from(config.tokenIv),
        tokenTag: Buffer.from(config.tokenTag),
      });
      if (token) return { tokenId: config.tokenId, token, smsId: config.smsId };
    }
  }

  // Env-Fallback
  const tokenId = process.env.SIPGATE_TOKEN_ID;
  const token = process.env.SIPGATE_TOKEN;
  const smsId = process.env.SIPGATE_SMS_ID ?? "s0";
  if (tokenId && token) return { tokenId, token, smsId };

  return null;
}

// ── Account-Info ──────────────────────────────────────────────────────────────

export type SipgateAccountInfo = {
  status: "ok" | "auth_error" | "error" | "unconfigured";
  balance?: { amount: number; currency: string };
  smsDevices?: Array<{ id: string; alias: string; smsId: string }>;
  error?: string;
};

/**
 * Fragt sipgate-Kontoinformationen ab: Guthaben + SMS-Geräte.
 * Wird für die Status-Anzeige im Reseller-Portal verwendet.
 */
export async function getSipgateAccountInfo(resellerId?: string): Promise<SipgateAccountInfo> {
  const creds = await resolveCredentials(resellerId);
  if (!creds) return { status: "unconfigured" };

  const authHeader = "Basic " + Buffer.from(`${creds.tokenId}:${creds.token}`).toString("base64");

  try {
    const [balanceRes, smsRes] = await Promise.all([
      fetch("https://api.sipgate.com/v2/balance", {
        headers: { Authorization: authHeader, Accept: "application/json" },
      }),
      fetch("https://api.sipgate.com/v2/sms", {
        headers: { Authorization: authHeader, Accept: "application/json" },
      }),
    ]);

    if (balanceRes.status === 401 || balanceRes.status === 403) {
      return { status: "auth_error", error: `HTTP ${balanceRes.status}: Zugangsdaten ungültig` };
    }

    if (!balanceRes.ok) {
      return { status: "error", error: `HTTP ${balanceRes.status}` };
    }

    const balanceData = await balanceRes.json() as { amount: number; currency: string };
    const balance = { amount: balanceData.amount / 10000, currency: balanceData.currency };

    let smsDevices: Array<{ id: string; alias: string; smsId: string }> = [];
    if (smsRes.ok) {
      const smsData = await smsRes.json() as { items?: Array<{ id: string; alias: string; smsId?: string }> };
      smsDevices = (smsData.items ?? []).map((d) => ({
        id: d.id,
        alias: d.alias ?? d.id,
        smsId: d.smsId ?? d.id,
      }));
    }

    return { status: "ok", balance, smsDevices };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Verbindungsfehler";
    return { status: "error", error: msg };
  }
}

// ── Senden ────────────────────────────────────────────────────────────────────

/**
 * Sendet eine SMS via sipgate REST API.
 * Liest Zugangsdaten zuerst aus der DB (per resellerId), dann aus Env-Variablen.
 */
export async function sendSms(
  to: string,
  message: string,
  resellerId?: string,
): Promise<SmsResult> {
  const creds = await resolveCredentials(resellerId);

  if (!creds) {
    return { ok: false, error: "Keine sipgate-Konfiguration gefunden (DB oder Env)" };
  }

  const formatted = formatPhoneE164(to);
  if (!formatted) {
    return { ok: false, error: `Ungültiges Nummernformat: ${to}` };
  }

  const res = await fetch(SIPGATE_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from(`${creds.tokenId}:${creds.token}`).toString("base64"),
    },
    body: JSON.stringify({ smsId: creds.smsId, message, recipient: formatted }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `sipgate ${res.status}: ${body}` };
  }
  return { ok: true };
}
