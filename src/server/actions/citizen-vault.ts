"use server";

import { prisma } from "@/lib/db";
import { requireCitizenAccount } from "@/lib/auth-helpers";
import {
  encrypt,
  decrypt,
  generateKey,
  getMasterKey,
  unwrapTenantMasterKey,
  unwrapMessageKey,
} from "@/lib/crypto/envelope";
import { deriveKeyFromPassword, generateSalt } from "@/lib/crypto/kdf";
import { logger } from "@/lib/logger";
import { z } from "zod";
import type { VaultMessageBlobs } from "@/lib/crypto/client-vault";

const VAULT_PASSWORD_MIN = 10;
const vaultPasswordSchema = z
  .string()
  .min(VAULT_PASSWORD_MIN, `Tresor-Passwort muss mindestens ${VAULT_PASSWORD_MIN} Zeichen haben`)
  .regex(/[A-Z]/, "Mindestens ein Großbuchstabe erforderlich")
  .regex(/[0-9]/, "Mindestens eine Ziffer erforderlich")
  .regex(/[^A-Za-z0-9]/, "Mindestens ein Sonderzeichen erforderlich");

export type VaultResult = { ok: true } | { ok: false; error: string };

function toHex(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString("hex");
}

// ── Vault einrichten ──────────────────────────────────────────────────────────

export async function setupVault(vaultPassword: string): Promise<VaultResult> {
  const { citizenAccountId } = await requireCitizenAccount();

  const pwResult = vaultPasswordSchema.safeParse(vaultPassword);
  if (!pwResult.success) return { ok: false, error: pwResult.error.issues[0]?.message ?? "Ungültiges Passwort" };

  // 1. Zufälligen Customer Master Key (CMK) generieren
  const plainCMK = generateKey();

  // 2. CMK mit PBKDF2-abgeleitetem Schlüssel verschlüsseln (Citizen-seitig)
  const salt = generateSalt();
  const derivedKey = await deriveKeyFromPassword(vaultPassword, salt);
  const citizenWrapped = encrypt(plainCMK, derivedKey);

  // 3. CMK mit MASTER_KEY verschlüsseln (Server-seitig für Versand neuer Nachrichten)
  const masterKey = getMasterKey();
  const masterWrapped = encrypt(plainCMK, masterKey);

  await prisma.citizenAccount.update({
    where: { id: citizenAccountId },
    data: {
      vaultSalt: new Uint8Array(salt),
      vaultKey: Buffer.from(citizenWrapped.ciphertext),
      vaultKeyIv: Buffer.from(citizenWrapped.iv),
      vaultKeyAuthTag: Buffer.from(citizenWrapped.authTag),
      vaultKeyMaster: Buffer.from(masterWrapped.ciphertext),
      vaultKeyMasterIv: Buffer.from(masterWrapped.iv),
      vaultKeyMasterAuthTag: Buffer.from(masterWrapped.authTag),
      vaultEnabled: true,
    },
  });

  logger.info({ citizenAccountId }, "Vault setup complete");
  return { ok: true };
}

// ── Vault-Passwort ändern ─────────────────────────────────────────────────────

export async function changeVaultPassword(
  oldPassword: string,
  newPassword: string,
): Promise<VaultResult> {
  const { citizenAccountId } = await requireCitizenAccount();

  const pwResult = vaultPasswordSchema.safeParse(newPassword);
  if (!pwResult.success) return { ok: false, error: pwResult.error.issues[0]?.message ?? "Ungültiges Passwort" };

  const ca = await prisma.citizenAccount.findUnique({ where: { id: citizenAccountId } });
  if (!ca?.vaultEnabled || !ca.vaultSalt || !ca.vaultKey || !ca.vaultKeyIv || !ca.vaultKeyAuthTag) {
    return { ok: false, error: "Kein Tresor eingerichtet" };
  }

  // Alten CMK server-seitig entschlüsseln (für Re-Wrapping)
  const oldSalt = Buffer.from(ca.vaultSalt);
  const oldDerivedKey = await deriveKeyFromPassword(oldPassword, oldSalt);
  let plainCMK: Buffer;
  try {
    plainCMK = decrypt(
      {
        ciphertext: Buffer.from(ca.vaultKey),
        iv: Buffer.from(ca.vaultKeyIv),
        authTag: Buffer.from(ca.vaultKeyAuthTag),
      },
      oldDerivedKey,
    );
  } catch {
    return { ok: false, error: "Aktuelles Tresor-Passwort ist falsch" };
  }

  // CMK mit neuem Schlüssel verschlüsseln
  const newSalt = generateSalt();
  const newDerivedKey = await deriveKeyFromPassword(newPassword, newSalt);
  const newCitizenWrapped = encrypt(plainCMK, newDerivedKey);

  await prisma.citizenAccount.update({
    where: { id: citizenAccountId },
    data: {
      vaultSalt: new Uint8Array(newSalt),
      vaultKey: Buffer.from(newCitizenWrapped.ciphertext),
      vaultKeyIv: Buffer.from(newCitizenWrapped.iv),
      vaultKeyAuthTag: Buffer.from(newCitizenWrapped.authTag),
    },
  });

  logger.info({ citizenAccountId }, "Vault password changed");
  return { ok: true };
}

// ── Verschlüsselte Blobs für Client-Side Decryption liefern ─────────────────
//
// Diese Funktion sendet KEINE Klartexte. Der Client entschlüsselt alles
// im Browser mit Web Crypto API — das Tresor-Passwort verlässt den Browser nie.

export type GetBlobsResult =
  | { ok: true; blobs: VaultMessageBlobs }
  | { ok: false; error: string };

export async function getVaultMessageBlobs(messageId: string): Promise<GetBlobsResult> {
  const { citizenAccountId } = await requireCitizenAccount();

  // Zugriffscheck
  const customers = await prisma.customer.findMany({
    where: { citizenAccountId },
    select: { id: true },
  });
  const customerIds = customers.map((c) => c.id);

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      attachments: {
        where: { virusScanStatus: "CLEAN" },
        select: {
          id: true,
          filenameCiphertext: true,
          filenameIv: true,
          filenameAuthTag: true,
          mimeType: true,
          sizeBytes: true,
        },
      },
    },
  });

  if (!message || !customerIds.includes(message.recipientId)) {
    return { ok: false, error: "Nachricht nicht gefunden" };
  }

  if (!message.vaultMessageKey || !message.vaultMessageKeyIv || !message.vaultMessageKeyAuthTag) {
    return { ok: false, error: "Nachricht hat keine Vault-Verschlüsselung" };
  }

  const ca = await prisma.citizenAccount.findUnique({ where: { id: citizenAccountId } });
  if (!ca?.vaultEnabled || !ca.vaultSalt || !ca.vaultKey || !ca.vaultKeyIv || !ca.vaultKeyAuthTag) {
    return { ok: false, error: "Kein Tresor eingerichtet" };
  }

  // Alle Blobs als Hex-Strings zurückgeben — kein Klartext
  const blobs: VaultMessageBlobs = {
    vault: {
      salt: toHex(ca.vaultSalt),
      key: {
        ct: toHex(ca.vaultKey),
        iv: toHex(ca.vaultKeyIv),
        tag: toHex(ca.vaultKeyAuthTag),
      },
    },
    msgKey: {
      ct: toHex(message.vaultMessageKey),
      iv: toHex(message.vaultMessageKeyIv),
      tag: toHex(message.vaultMessageKeyAuthTag),
    },
    body: {
      ct: toHex(message.bodyCiphertext),
      iv: toHex(message.bodyIv),
      tag: toHex(message.bodyAuthTag),
    },
    subject:
      message.subjectIsEncrypted && message.subjectCiphertext && message.subjectIv && message.subjectAuthTag
        ? {
            ct: toHex(message.subjectCiphertext),
            iv: toHex(message.subjectIv),
            tag: toHex(message.subjectAuthTag),
          }
        : undefined,
    subjectPlain: !message.subjectIsEncrypted ? (message.subjectPlain ?? undefined) : undefined,
    attachments: message.attachments.map((att) => ({
      id: att.id,
      filename: {
        ct: toHex(att.filenameCiphertext),
        iv: toHex(att.filenameIv),
        tag: toHex(att.filenameAuthTag),
      },
      mimeType: att.mimeType,
      size: Number(att.sizeBytes),
    })),
  };

  return { ok: true, blobs };
}

// ── TMK-basierter Entschlüsselungs-Fallback (LEVEL_1/2 ohne Vault) ───────────

export type TmkDecryptResult =
  | { ok: true; subject: string; body: string; attachmentFilenames: Record<string, string> }
  | { ok: false; error: string };

export async function decryptMessageForCitizen(messageId: string): Promise<TmkDecryptResult> {
  const { citizenAccountId } = await requireCitizenAccount();

  const customers = await prisma.customer.findMany({
    where: { citizenAccountId },
    select: { id: true },
  });
  const customerIds = customers.map((c) => c.id);

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      tenant: {
        select: { tenantMasterKey: true, tmkIv: true, tmkAuthTag: true },
      },
      attachments: {
        where: { virusScanStatus: "CLEAN" },
        select: { id: true, filenameCiphertext: true, filenameIv: true, filenameAuthTag: true },
      },
    },
  });

  if (!message || !customerIds.includes(message.recipientId)) {
    return { ok: false, error: "Nachricht nicht gefunden" };
  }

  try {
    const tmk = unwrapTenantMasterKey({
      tenantMasterKey: Buffer.from(message.tenant.tenantMasterKey),
      tmkIv: Buffer.from(message.tenant.tmkIv),
      tmkAuthTag: Buffer.from(message.tenant.tmkAuthTag),
    });

    const mk = unwrapMessageKey(
      {
        messageKey: Buffer.from(message.messageKey),
        messageKeyIv: Buffer.from(message.messageKeyIv),
        messageKeyAuthTag: Buffer.from(message.messageKeyAuthTag),
      },
      tmk,
    );

    const body = decrypt(
      { ciphertext: Buffer.from(message.bodyCiphertext), iv: Buffer.from(message.bodyIv), authTag: Buffer.from(message.bodyAuthTag) },
      mk,
    ).toString("utf-8");

    let subject = "(kein Betreff)";
    if (message.subjectIsEncrypted && message.subjectCiphertext && message.subjectIv && message.subjectAuthTag) {
      subject = decrypt(
        { ciphertext: Buffer.from(message.subjectCiphertext), iv: Buffer.from(message.subjectIv), authTag: Buffer.from(message.subjectAuthTag) },
        mk,
      ).toString("utf-8");
    } else if (message.subjectPlain) {
      subject = message.subjectPlain;
    }

    const attachmentFilenames: Record<string, string> = {};
    for (const att of message.attachments) {
      try {
        attachmentFilenames[att.id] = decrypt(
          { ciphertext: Buffer.from(att.filenameCiphertext), iv: Buffer.from(att.filenameIv), authTag: Buffer.from(att.filenameAuthTag) },
          mk,
        ).toString("utf-8");
      } catch {
        attachmentFilenames[att.id] = "Anhang";
      }
    }

    return { ok: true, subject, body, attachmentFilenames };
  } catch {
    return { ok: false, error: "Nachricht konnte nicht entschlüsselt werden" };
  }
}
