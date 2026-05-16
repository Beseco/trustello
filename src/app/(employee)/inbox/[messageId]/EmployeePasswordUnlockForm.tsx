"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Lock, Unlock, Loader2, Download, Paperclip } from "lucide-react";
import { RichTextPreview } from "@/components/RichTextPreview";
import { decryptMessageForEmployee, type DecryptedMessage } from "@/server/actions/message-decrypt";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  messageId: string;
  passwordHint?: string | null;
};

function formatBytes(bytes: string): string {
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmployeePasswordUnlockForm({ messageId, passwordHint }: Props) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decrypted, setDecrypted] = useState<DecryptedMessage | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUnlock() {
    if (!password.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await decryptMessageForEmployee(messageId, password);
      if (result.ok) {
        setDecrypted(result.message);
      } else {
        setError(result.error);
      }
    });
  }

  if (decrypted) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
          <Unlock className="h-4 w-4" />
          <span>Nachricht entschlüsselt</span>
        </div>

        <RichTextPreview html={decrypted.body} />

        {decrypted.attachments.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Paperclip className="h-4 w-4" />
                {decrypted.attachments.length} Anhang{decrypted.attachments.length > 1 ? "e" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {decrypted.attachments.map((att) => (
                  <li
                    key={att.id}
                    className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <span className="flex-1 truncate font-medium">{att.filename}</span>
                    <span className="text-xs text-muted-foreground">{formatBytes(att.sizeBytes)}</span>
                    <a
                      href={att.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Download className="h-3 w-3" />
                      Herunterladen
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <Lock className="h-8 w-8 text-muted-foreground" />
      <p className="text-center text-sm text-muted-foreground">
        Diese Nachricht ist passwortgeschützt. Geben Sie das vereinbarte Passwort ein.
      </p>
      {passwordHint && (
        <p className="text-center text-xs text-muted-foreground">
          Hinweis: <span className="font-medium">{passwordHint}</span>
        </p>
      )}
      <div className="flex w-full max-w-xs flex-col gap-2">
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Passwort eingeben"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            className="pr-10"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          onClick={handleUnlock}
          disabled={isPending || !password.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Entsperren
        </button>
      </div>
    </div>
  );
}
