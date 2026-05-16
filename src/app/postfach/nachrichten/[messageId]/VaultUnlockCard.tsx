"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, ShieldAlert, Loader2, Eye, EyeOff, AlertCircle, Paperclip, Download, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getVaultMessageBlobs } from "@/server/actions/citizen-vault";
import { decryptVaultMessage } from "@/lib/crypto/client-vault";
import type { VaultMessageBlobs } from "@/lib/crypto/client-vault";
import { RichTextPreview } from "@/components/RichTextPreview";

type Props = {
  messageId: string;
  attachmentCount: number;
  attachmentIds: string[];
  attachmentMimeTypes: Record<string, string>;
  attachmentSizes: Record<string, number>;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VaultUnlockCard({
  messageId,
  attachmentCount,
  attachmentIds,
  attachmentMimeTypes,
  attachmentSizes,
}: Props) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Blobs werden beim Laden der Komponente vom Server geholt (noch verschlüsselt)
  const [blobs, setBlobs] = useState<VaultMessageBlobs | null>(null);
  const [blobsError, setBlobsError] = useState<string | null>(null);
  const [blobsLoading, setBlobsLoading] = useState(true);

  const [decrypted, setDecrypted] = useState<{
    subject: string;
    body: string;
    attachmentFilenames: Record<string, string>;
  } | null>(null);

  // Verschlüsselte Blobs beim Mount laden
  useEffect(() => {
    getVaultMessageBlobs(messageId).then((result) => {
      setBlobsLoading(false);
      if (!result.ok) {
        setBlobsError(result.error);
        return;
      }
      setBlobs(result.blobs);
    });
  }, [messageId]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!blobs || !password) return;

    setError(null);
    setIsDecrypting(true);

    try {
      // Entschlüsselung findet vollständig im Browser statt (Web Crypto API)
      // Das Passwort wird NICHT an den Server gesendet
      const result = await decryptVaultMessage(password, blobs);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setDecrypted(result);
    } finally {
      // Passwort sofort aus dem Speicher entfernen
      setPassword("");
      setIsDecrypting(false);
    }
  }

  // ── Entschlüsselte Ansicht ─────────────────────────────────────────────────
  if (decrypted) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>Im Browser entschlüsselt — Ihr Tresor-Passwort hat den Server nie erreicht</span>
          </div>
          <RichTextPreview html={decrypted.body} />
        </div>

        {attachmentCount > 0 && (
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Paperclip className="h-4 w-4" />
              {attachmentCount} Anhang{attachmentCount > 1 ? "e" : ""}
            </p>
            <ul className="space-y-2">
              {attachmentIds.map((id) => (
                <li key={id} className="flex items-center gap-3 rounded-lg border bg-slate-50 px-3 py-2 text-sm">
                  <span className="flex-1 truncate">{decrypted.attachmentFilenames[id] ?? "Anhang"}</span>
                  <span className="shrink-0 text-xs text-slate-400">{formatBytes(attachmentSizes[id] ?? 0)}</span>
                  <a
                    href={`/m/${messageId}/attachments/${id}`}
                    className="flex shrink-0 items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Herunterladen
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // ── Fehler beim Laden der Blobs ────────────────────────────────────────────
  if (blobsError) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          {blobsError}
        </div>
      </div>
    );
  }

  // ── Passwort-Eingabe ───────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
          {blobsLoading
            ? <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            : <ShieldCheck className="h-6 w-6 text-blue-600" />
          }
        </div>
        <div>
          <p className="font-semibold text-slate-900">Ende-zu-Ende verschlüsselt</p>
          <p className="mt-1 text-sm text-slate-500">
            Diese Nachricht wurde mit Ihrem persönlichen Tresor verschlüsselt.
            Die Entschlüsselung erfolgt ausschließlich in Ihrem Browser.
          </p>
        </div>
      </div>

      <form onSubmit={handleUnlock} className="space-y-4">
        <div>
          <Label htmlFor="vaultPassword">Tresor-Passwort</Label>
          <div className="relative mt-1">
            <Input
              id="vaultPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ihr Tresor-Passwort eingeben"
              autoFocus
              required
              disabled={blobsLoading}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={isDecrypting || blobsLoading || !password}
        >
          {isDecrypting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Entschlüssele im Browser…
            </>
          ) : (
            <>
              <Lock className="mr-2 h-4 w-4" />
              Nachricht entschlüsseln
            </>
          )}
        </Button>

        <p className="text-center text-xs text-slate-400">
          Ihr Passwort wird ausschließlich lokal verwendet und nie übertragen.
        </p>
      </form>
    </div>
  );
}
