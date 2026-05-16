"use client";

import { useState, useTransition } from "react";
import { setCustomerPassword, disableCustomerAccount } from "@/server/actions/customer-account";
import { Input } from "@/components/ui/input";
import { ShieldCheck, ShieldOff, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

type Props = { customerId: string; hasAccount: boolean; tenantSlug: string };

export function CustomerAccountCard({ customerId, hasAccount, tenantSlug }: Props) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "set">("idle");

  function handleSet() {
    if (!password.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await setCustomerPassword(customerId, password);
      if (result.error) {
        setError(result.error);
      } else {
        toast.success("Konto-Passwort gesetzt");
        setPassword("");
        setMode("idle");
      }
    });
  }

  function handleDisable() {
    if (!confirm("Bürger-Konto deaktivieren? Der Kunde kann sich dann nicht mehr einloggen.")) return;
    startTransition(async () => {
      const result = await disableCustomerAccount(customerId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Konto deaktiviert");
      }
    });
  }

  const portalUrl = `/portal/${tenantSlug}/login`;

  return (
    <div className="space-y-3">
      {hasAccount ? (
        <>
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
            <ShieldCheck className="h-4 w-4" />
            <span>Bürger-Konto aktiv</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Login-URL:{" "}
            <a href={portalUrl} target="_blank" className="font-mono underline hover:text-foreground">
              {portalUrl}
            </a>
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setMode("set")}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Passwort ändern
            </button>
            <button
              onClick={handleDisable}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-md border border-destructive/50 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <ShieldOff className="h-3.5 w-3.5" />
              Konto deaktivieren
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldOff className="h-4 w-4" />
            <span>Kein Bürger-Konto</span>
          </div>
          <button
            onClick={() => setMode("set")}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Konto einrichten
          </button>
        </>
      )}

      {mode === "set" && (
        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Neues Passwort für den Kunden setzen (mind. 10 Zeichen, Großbuchstabe, Ziffer, Sonderzeichen):
          </p>
          <div className="relative max-w-xs">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Passwort"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
          <div className="flex gap-2">
            <button
              onClick={handleSet}
              disabled={isPending || !password.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Speichern
            </button>
            <button
              onClick={() => { setMode("idle"); setPassword(""); setError(null); }}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
