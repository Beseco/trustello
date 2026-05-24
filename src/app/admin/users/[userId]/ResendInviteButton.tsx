"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, CheckCircle } from "lucide-react";
import { resendInvite } from "@/server/actions/admin-users";

export function ResendInviteButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const result = await resendInvite(userId);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSent(true);
      setTimeout(() => setSent(false), 4000);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Sendet eine neue Einladungs-E-Mail mit einem frischen temporären Passwort.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={loading || sent}
        className="gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : sent ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
        {sent ? "E-Mail gesendet ✓" : "Einladung erneut senden"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
