/**
 * Browser-only: Web Crypto API Helfer für client-seitige Vault-Entschlüsselung.
 *
 * Das Tresor-Passwort verlässt den Browser NIE — alle kryptographischen
 * Operationen finden ausschließlich im Browser statt.
 *
 * KDF-Parameter müssen exakt mit kdf.ts übereinstimmen:
 *   PBKDF2 · SHA-256 · 600.000 Iterationen · 32 Byte Output
 */

// Muss mit PBKDF2_ITERATIONS in kdf.ts übereinstimmen
const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_HASH = "SHA-256";
const KEY_LEN_BITS = 256;

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0) throw new Error("Ungültiger Hex-String");
  // Explizit ArrayBuffer (nicht ArrayBufferLike) — erforderlich für Web Crypto API
  const buf = new ArrayBuffer(hex.length / 2);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return arr;
}

export type EncryptedBlob = {
  ct: string;  // Ciphertext (hex)
  iv: string;  // AES-GCM IV, 12 Byte (hex)
  tag: string; // Auth-Tag, 16 Byte (hex)
};

export type VaultMessageBlobs = {
  vault: {
    salt: string;      // PBKDF2-Salt (hex)
    key: EncryptedBlob; // CMK verschlüsselt mit PBKDF2-derived Key
  };
  msgKey: EncryptedBlob;     // Message Key verschlüsselt mit CMK
  body: EncryptedBlob;       // Nachrichteninhalt verschlüsselt mit Message Key
  subject?: EncryptedBlob;   // Betreff verschlüsselt (nur wenn subjectIsEncrypted)
  subjectPlain?: string;     // Betreff im Klartext (wenn nicht verschlüsselt)
  attachments: Array<{
    id: string;
    filename: EncryptedBlob;
    mimeType: string;
    size: number;
  }>;
};

export type ClientDecryptResult =
  | { ok: true; subject: string; body: string; attachmentFilenames: Record<string, string> }
  | { ok: false; error: string };

// ── Interne Hilfsfunktionen ───────────────────────────────────────────────────

async function deriveKey(password: string, saltHex: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: hexToBytes(saltHex),
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LEN_BITS },
    false,
    ["decrypt"],
  );
}

async function aesGcmDecrypt(key: CryptoKey, blob: EncryptedBlob): Promise<ArrayBuffer> {
  const ct = hexToBytes(blob.ct);
  const tag = hexToBytes(blob.tag);
  const iv = hexToBytes(blob.iv);

  // Web Crypto AES-GCM erwartet: ciphertext || authTag (konkateniert)
  const data = new Uint8Array(ct.length + tag.length);
  data.set(ct);
  data.set(tag, ct.length);

  return crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, data);
}

async function importRawKey(buf: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", buf, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
}

// ── Öffentliche API ───────────────────────────────────────────────────────────

/**
 * Entschlüsselt eine Vault-Nachricht vollständig im Browser mit Web Crypto API.
 *
 * Ablauf:
 *   1. PBKDF2(password, salt) → derivedKey
 *   2. AES-GCM-Decrypt(vaultKey, derivedKey) → CMK
 *   3. AES-GCM-Decrypt(msgKey, CMK) → Message Key
 *   4. AES-GCM-Decrypt(body, Message Key) → Klartext
 *   5. AES-GCM-Decrypt(subject, Message Key) → Betreff (falls verschlüsselt)
 *   6. AES-GCM-Decrypt(filename, Message Key) → Dateinamen
 */
export async function decryptVaultMessage(
  password: string,
  blobs: VaultMessageBlobs,
): Promise<ClientDecryptResult> {
  try {
    const dec = new TextDecoder("utf-8");

    // 1. Schlüssel aus Passwort ableiten
    const derivedKey = await deriveKey(password, blobs.vault.salt);

    // 2. CMK entschlüsseln
    const cmkBuf = await aesGcmDecrypt(derivedKey, blobs.vault.key);
    const cmkKey = await importRawKey(cmkBuf);

    // 3. Message Key entschlüsseln
    const mkBuf = await aesGcmDecrypt(cmkKey, blobs.msgKey);
    const mkKey = await importRawKey(mkBuf);

    // 4. Nachrichteninhalt entschlüsseln
    const bodyBuf = await aesGcmDecrypt(mkKey, blobs.body);
    const body = dec.decode(bodyBuf);

    // 5. Betreff entschlüsseln
    let subject = "(kein Betreff)";
    if (blobs.subject) {
      const subjectBuf = await aesGcmDecrypt(mkKey, blobs.subject);
      subject = dec.decode(subjectBuf);
    } else if (blobs.subjectPlain) {
      subject = blobs.subjectPlain;
    }

    // 6. Dateinamen entschlüsseln
    const attachmentFilenames: Record<string, string> = {};
    for (const att of blobs.attachments) {
      try {
        const fnBuf = await aesGcmDecrypt(mkKey, att.filename);
        attachmentFilenames[att.id] = dec.decode(fnBuf);
      } catch {
        attachmentFilenames[att.id] = "Anhang";
      }
    }

    return { ok: true, subject, body, attachmentFilenames };
  } catch {
    // Falsches Passwort → AES-GCM Auth-Tag Fehler (OperationError)
    return { ok: false, error: "Falsches Tresor-Passwort" };
  }
}
