"use client";

import { useState, useTransition, useRef } from "react";
import { Loader2, MessageSquarePlus, Paperclip, X, FileText, CheckCircle2 } from "lucide-react";
import { submitCitizenReply } from "@/server/actions/citizen-reply";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ReplyForm({
  messageId,
  allowAttachments,
}: {
  messageId: string;
  allowAttachments: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(e.target.files ?? []);
    setAttachments((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...newFiles.filter((f) => !existing.has(f.name + f.size))];
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("originalMessageId", messageId);
      fd.append("body", body.trim());
      for (const file of attachments) fd.append("attachments", file);
      const result = await submitCitizenReply(fd);
      if (result.ok) {
        setSent(true);
      } else {
        setError(result.error);
      }
    });
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-green-50/50 p-6 text-center dark:bg-green-950/20">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
        <p className="font-medium">Antwort gesendet</p>
        <p className="text-sm text-muted-foreground">
          Ihre Antwort wurde erfolgreich übermittelt.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
      >
        <MessageSquarePlus className="h-4 w-4" />
        Antworten
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium">Antwort verfassen</p>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Ihre Antwort…"
        rows={5}
        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        autoFocus
      />

      {allowAttachments && (
        <div className="space-y-2">
          {attachments.length > 0 && (
            <ul className="space-y-1">
              {attachments.map((file, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="h-4 w-4" />
            Datei hinzufügen
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending || !body.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Antwort senden
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setBody(""); setAttachments([]); setError(null); }}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
