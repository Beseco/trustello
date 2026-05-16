"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toggleUserActive, resetUserPasswordAdmin } from "@/server/actions/admin-users";
import { Button } from "@/components/ui/button";
import { Loader2, Copy } from "lucide-react";

type Props = {
  userId: string;
  isActive: boolean;
  isSelf: boolean;
  variant: "password" | "status";
};

export function DangerZone({ userId, isActive, isSelf, variant }: Props) {
  const [pending, startTransition] = useTransition();
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [localActive, setLocalActive] = useState(isActive);

  if (variant === "password") {
    if (tempPassword) {
      return (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Temporäres Passwort — bitte sofort an den Benutzer weitergeben:
          </p>
          <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 font-mono text-sm">
            <span className="flex-1 select-all">{tempPassword}</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(tempPassword);
                toast.success("Kopiert");
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-amber-600">
            Das Passwort wird nur einmal angezeigt. Der Benutzer sollte es sofort ändern.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Generiert ein neues temporäres Passwort. Das bisherige Passwort wird sofort ungültig.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await resetUserPasswordAdmin(userId);
              if (result.error) {
                toast.error(result.error);
              } else if (result.tempPassword) {
                setTempPassword(result.tempPassword);
              }
            });
          }}
        >
          {pending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Passwort zurücksetzen
        </Button>
      </div>
    );
  }

  // variant === "status"
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {localActive
          ? "Deaktivierte Benutzer können sich nicht mehr einloggen. Nachrichten bleiben erhalten."
          : "Aktivierte Benutzer können sich wieder einloggen."}
      </p>
      {!isSelf && (
        <Button
          type="button"
          variant={localActive ? "destructive" : "default"}
          size="sm"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await toggleUserActive(userId, !localActive);
              if (result.error) {
                toast.error(result.error);
              } else {
                setLocalActive((v) => !v);
                toast.success(localActive ? "Benutzer deaktiviert" : "Benutzer aktiviert");
              }
            });
          }}
        >
          {pending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          {localActive ? "Konto deaktivieren" : "Konto aktivieren"}
        </Button>
      )}
    </div>
  );
}
