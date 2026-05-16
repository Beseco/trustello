"use client";

import { useTransition } from "react";
import { sendPinLetter, type PinLetterStatus } from "@/server/actions/pin-letter";
import { Mail, Loader2, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

type Props = {
  customerId: string;
  hasAddress: boolean;
  status: PinLetterStatus | null;
};

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function PinLetterButton({ customerId, hasAddress, status }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSend() {
    startTransition(async () => {
      const result = await sendPinLetter(customerId);
      if (result.ok) {
        router.refresh();
      } else {
        alert(`Fehler: ${result.error}`);
      }
    });
  }

  const isExpired = status && !status.usedAt && status.expiresAt < new Date();
  const isAwaiting = status && !status.usedAt && !status.supersededAt && !isExpired;

  return (
    <div className="space-y-3">
      {/* Status des letzten Briefes */}
      {status && (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1.5">
          {status.usedAt ? (
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              <span>Verifiziert am {formatDate(status.usedAt)}</span>
            </div>
          ) : isExpired ? (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>Abgelaufen (versendet {formatDate(status.sentAt)})</span>
            </div>
          ) : isAwaiting ? (
            <div className="flex items-center gap-2 text-amber-600">
              <Clock className="h-4 w-4" />
              <span>
                Ausstehend — versendet {formatDate(status.sentAt)}, gültig bis{" "}
                {formatDate(status.expiresAt)}
              </span>
            </div>
          ) : null}
          {status.attempts > 0 && (
            <p className="text-xs text-muted-foreground">
              {status.attempts} Fehlversuch{status.attempts !== 1 ? "e" : ""}
            </p>
          )}
          {status.letterxpressId && (
            <p className="text-xs text-muted-foreground">
              Job-ID: <span className="font-mono">{status.letterxpressId}</span>
            </p>
          )}
        </div>
      )}

      {/* Button */}
      <div className="flex items-center gap-3">
        <Button
          variant={status?.usedAt ? "outline" : "default"}
          size="sm"
          onClick={handleSend}
          disabled={isPending || !hasAddress}
          title={!hasAddress ? "Bitte zuerst die Postanschrift des Kunden hinterlegen" : undefined}
        >
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Mail className="mr-2 h-4 w-4" />
          )}
          {status ? "Neuen Brief senden" : "PIN-Brief senden"}
        </Button>

        {!hasAddress && (
          <p className="text-xs text-amber-600">
            ⚠ Bitte zuerst Postanschrift hinterlegen
          </p>
        )}
      </div>
    </div>
  );
}
