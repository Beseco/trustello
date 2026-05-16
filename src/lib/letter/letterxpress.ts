/**
 * LetterXpress REST-Client
 * Sendet physische Briefe über die LetterXpress-API (https://www.letterxpress.de/api)
 */

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { encryptToken, decryptToken } from "@/lib/letter/crypto";

const LX_API = "https://api.letterxpress.de/v1";

export type LetterxpressConfigData = {
  username: string;
  hasApiKey: boolean;
};

export type SendLetterResult =
  | { ok: true; jobId: string }
  | { ok: false; error: string };

export type LetterxpressStatusResult = {
  status: "ok" | "auth_error" | "error" | "unconfigured";
  balance?: { amount: number; currency: string };
  error?: string;
};


// ── Credential-Helfer ──────────────────────────────────────────────────────────

export function encryptApiKey(apiKey: string) {
  return encryptToken(apiKey);
}

export function decryptApiKey(enc: {
  apiKeyEnc: Buffer | Uint8Array;
  apiKeyIv: Buffer | Uint8Array;
  apiKeyTag: Buffer | Uint8Array;
}): string | null {
  return decryptToken({
    tokenEnc: Buffer.from(enc.apiKeyEnc),
    tokenIv: Buffer.from(enc.apiKeyIv),
    tokenTag: Buffer.from(enc.apiKeyTag),
  });
}

async function resolveCredentials(
  resellerId?: string,
): Promise<{ username: string; apiKey: string } | null> {
  if (resellerId) {
    const config = await prisma.letterxpressConfig.findUnique({ where: { resellerId } });
    if (config) {
      const apiKey = decryptApiKey({
        apiKeyEnc: config.apiKeyEnc,
        apiKeyIv: config.apiKeyIv,
        apiKeyTag: config.apiKeyTag,
      });
      if (apiKey) return { username: config.username, apiKey };
    }
  }
  // Env-Var-Fallback
  const username = process.env.LETTERXPRESS_USERNAME;
  const apiKey = process.env.LETTERXPRESS_API_KEY;
  if (username && apiKey) return { username, apiKey };
  return null;
}

// LetterXpress nutzt JSON-Body-Auth (kein HTTP Basic)
function authPayload(username: string, apiKey: string) {
  return { auth: { username, apikey: apiKey } };
}

// ── Verbindungsstatus ──────────────────────────────────────────────────────────

export async function getLetterxpressStatus(
  resellerId?: string,
): Promise<LetterxpressStatusResult> {
  const creds = await resolveCredentials(resellerId);
  if (!creds) return { status: "unconfigured" };

  try {
    const res = await fetch(`${LX_API}/getBalance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(authPayload(creds.username, creds.apiKey)),
    });

    if (res.status === 401 || res.status === 403) {
      return { status: "auth_error", error: `HTTP ${res.status}` };
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { status: "error", error: `HTTP ${res.status}${body ? `: ${body}` : ""}` };
    }

    const data = await res.json().catch(() => null);
    // LetterXpress: { status: 200, balance: { value: "8.04", currency: "EUR" } }
    const balanceObj = data?.balance;
    const amount = balanceObj?.value ?? null;
    const currency = balanceObj?.currency ?? "EUR";
    return {
      status: "ok",
      balance: amount !== null ? { amount: parseFloat(String(amount)), currency } : undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Verbindung fehlgeschlagen";
    return { status: "error", error: msg };
  }
}

// ── Brief senden ──────────────────────────────────────────────────────────────

export async function sendLetter(
  pdfBase64: string,
  resellerId?: string,
): Promise<SendLetterResult> {
  const creds = await resolveCredentials(resellerId);
  if (!creds) return { ok: false, error: "Keine LetterXpress-Konfiguration vorhanden" };

  const { createHash } = await import("node:crypto");
  const checksum = createHash("md5").update(pdfBase64).digest("hex");

  const payload = {
    ...authPayload(creds.username, creds.apiKey),
    letter: {
      base64_file: pdfBase64,
      base64_checksum: checksum,
      address: "pin-brief.pdf",
      specification: {
        color: 1,           // 1 = Schwarzweiß, 4 = Farbe (Integer!)
        mode: "simplex",
        ship: "national",
      },
    },
  };

  try {
    const res = await fetch(`${LX_API}/setJob`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn({ status: res.status, body }, "LetterXpress API error");
      return { ok: false, error: `LetterXpress ${res.status}: ${body}` };
    }

    const data = await res.json().catch(() => null);
    const jobId =
      data?.letter?.job_id ??
      data?.id ??
      data?.data?.id ??
      String(Date.now());
    return { ok: true, jobId: String(jobId) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Verbindung fehlgeschlagen";
    return { ok: false, error: msg };
  }
}
