"use client";

import { useState, useTransition } from "react";
import { Mail, Loader2, CheckCircle2, ShieldAlert } from "lucide-react";
import { requestMagicLink } from "@/server/actions/magic-link";

export function MagicLinkRequestForm({
  messageId,
  linkError,
}: {
  messageId: string;
  /** true = Link aus E-Mail war abgelaufen/bereits benutzt */
  linkError?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await requestMagicLink(messageId, email.trim());
      if (result.ok) {
        setSent(true);
      } else {
        setError(result.error);
      }
    });
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
        <p className="font-semibold">Neuer Zugangslink unterwegs</p>
        <p className="text-sm text-muted-foreground">
          Wenn Ihre E-Mail-Adresse für diese Nachricht hinterlegt ist, erhalten Sie in
          wenigen Minuten einen neuen Link.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col items-center gap-3 pb-2 text-center">
        <ShieldAlert className="h-10 w-10 text-amber-500" />
        <p className="font-semibold">
          {linkError ? "Zugangslink abgelaufen" : "Kein gültiger Zugangslink"}
        </p>
        <p className="text-sm text-muted-foreground">
          {linkError
            ? "Dieser Link wurde bereits verwendet oder ist abgelaufen."
            : "Um diese Nachricht zu öffnen, benötigen Sie einen persönlichen Zugangslink."}
        </p>
        <p className="text-sm text-muted-foreground">
          Geben Sie Ihre E-Mail-Adresse ein — wir senden Ihnen einen neuen Link.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="ml-email">
          Ihre E-Mail-Adresse
        </label>
        <input
          id="ml-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ihre@email.de"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          autoFocus
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <button
        type="submit"
        disabled={isPending || !email.trim()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        Neuen Zugangslink anfordern
      </button>
    </form>
  );
}
