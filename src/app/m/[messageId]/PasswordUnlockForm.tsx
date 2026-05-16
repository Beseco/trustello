"use client";

import { useState, useTransition } from "react";
import { Loader2, Lock, Download, Paperclip, Mail } from "lucide-react";
import { decryptWithPassword, type DecryptedMessage } from "@/server/actions/message-decrypt";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const SECURITY_LEVEL_LABELS: Record<string, string> = {
  LEVEL_3: "Stufe 3 — Passwortgeschützt",
  LEVEL_4: "Stufe 4 — Höchste Sicherheit",
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function PasswordUnlockForm({
  messageId,
  passwordHint,
}: {
  messageId: string;
  passwordHint: string | null;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<DecryptedMessage | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await decryptWithPassword(messageId, password);
      if (result.ok) {
        setUnlocked(result.message);
      } else {
        setError(result.error);
      }
    });
  }

  if (unlocked) {
    const sentDate = format(new Date(unlocked.sentAt), "dd. MMMM yyyy, HH:mm 'Uhr'", { locale: de });
    const expiresDate = format(new Date(unlocked.expiresAt), "dd. MMMM yyyy", { locale: de });

    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{unlocked.subject}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Von <span className="font-medium">{unlocked.senderName}</span> · {sentDate}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 text-xs">
            {SECURITY_LEVEL_LABELS[unlocked.securityLevel] ?? unlocked.securityLevel}
          </Badge>
        </div>

        <div className="rounded-md border bg-muted/30 p-4">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{unlocked.body}</pre>
        </div>

        {unlocked.attachments.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Paperclip className="h-4 w-4" />
              {unlocked.attachments.length} Anhang{unlocked.attachments.length > 1 ? "e" : ""}
            </p>
            <ul className="space-y-1">
              {unlocked.attachments.map((att) => (
                <li
                  key={att.id}
                  className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm"
                >
                  <span className="flex-1 truncate">{att.filename}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(Number(att.sizeBytes))}
                  </span>
                  <a
                    href={att.downloadUrl}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Herunterladen
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mail className="h-3 w-3" />
          <span>Verfügbar bis {expiresDate}</span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col items-center gap-3 pb-2 text-center">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <p className="font-semibold">Passwortgeschützte Nachricht</p>
        {passwordHint && (
          <p className="text-sm text-muted-foreground">Hinweis: {passwordHint}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="unlock-password">
          Passwort
        </label>
        <input
          id="unlock-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Passwort eingeben…"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          autoFocus
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <button
        type="submit"
        disabled={isPending || !password.trim()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Nachricht entsperren
      </button>
    </form>
  );
}
