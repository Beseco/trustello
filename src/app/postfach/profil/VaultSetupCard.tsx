"use client";

import { useState, useTransition } from "react";
import { Shield, Loader2, CheckCircle2, Eye, EyeOff, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setupVault, changeVaultPassword } from "@/server/actions/citizen-vault";

const VAULT_PASSWORD_MIN = 10;

type PasswordRule = { label: string; met: boolean };

function checkRules(pw: string): PasswordRule[] {
  return [
    { label: `${Math.max(0, VAULT_PASSWORD_MIN - pw.length)} Zeichen fehlen noch`, met: pw.length >= VAULT_PASSWORD_MIN },
    { label: "1 Großbuchstabe", met: /[A-Z]/.test(pw) },
    { label: "1 Ziffer", met: /[0-9]/.test(pw) },
    { label: "1 Sonderzeichen", met: /[^A-Za-z0-9]/.test(pw) },
  ];
}

function getLengthLabel(pw: string): string {
  if (pw.length === 0) return `Mind. ${VAULT_PASSWORD_MIN} Zeichen`;
  const remaining = VAULT_PASSWORD_MIN - pw.length;
  if (remaining > 0) return `Noch ${remaining} Zeichen`;
  return `${pw.length} Zeichen ✓`;
}

function PasswordStrengthIndicator({ password }: { password: string }) {
  if (password.length === 0) return null;
  const rules = checkRules(password);
  return (
    <ul className="mt-2 space-y-1">
      {rules.map((rule, i) => (
        <li key={i} className={`flex items-center gap-1.5 text-xs ${rule.met ? "text-green-600" : "text-slate-400"}`}>
          {rule.met ? (
            <Check className="h-3.5 w-3.5 shrink-0 text-green-500" />
          ) : (
            <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300 inline-block" />
          )}
          {i === 0 ? getLengthLabel(password) : rule.label}
        </li>
      ))}
    </ul>
  );
}

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  onChange,
  showStrength = false,
  showToggle = true,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  onChange?: (v: string) => void;
  showStrength?: boolean;
  showToggle?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [value, setValue] = useState("");

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative mt-1">
        <Input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onChange?.(e.target.value);
          }}
          required
        />
        {showToggle && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {showStrength && <PasswordStrengthIndicator password={value} />}
    </div>
  );
}

export function VaultSetupCard({ vaultEnabled }: { vaultEnabled: boolean }) {
  const [mode, setMode] = useState<"idle" | "setup" | "change">("idle");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSetup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const pw = data.get("password") as string;
    const confirm = data.get("confirm") as string;
    if (pw !== confirm) { setError("Passwörter stimmen nicht überein"); return; }
    setError(null);
    startTransition(async () => {
      const result = await setupVault(pw);
      if (!result.ok) { setError(result.error); return; }
      setSuccess(true);
      setMode("idle");
    });
  }

  function handleChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const oldPw = data.get("oldPassword") as string;
    const newPw = data.get("newPassword") as string;
    const confirm = data.get("confirm") as string;
    if (newPw !== confirm) { setError("Neue Passwörter stimmen nicht überein"); return; }
    setError(null);
    startTransition(async () => {
      const result = await changeVaultPassword(oldPw, newPw);
      if (!result.ok) { setError(result.error); return; }
      setSuccess(true);
      setMode("idle");
    });
  }

  if (success && mode === "idle") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        {vaultEnabled ? "Tresor-Passwort erfolgreich geändert." : "Tresor erfolgreich eingerichtet! Zukünftige Nachrichten werden Ende-zu-Ende verschlüsselt."}
      </div>
    );
  }

  if (mode === "idle") {
    return (
      <div className="space-y-3">
        {vaultEnabled ? (
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
            <Shield className="h-4 w-4 shrink-0" />
            Ihr Tresor ist aktiv. Neue Nachrichten werden Ende-zu-Ende verschlüsselt.
          </div>
        ) : (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            ⚠ Kein Tresor eingerichtet. Nachrichten werden serverseitig verschlüsselt, nicht Ende-zu-Ende.
          </div>
        )}
        <div className="flex gap-2">
          {!vaultEnabled && (
            <Button onClick={() => { setMode("setup"); setError(null); setSuccess(false); }} variant="default" size="sm">
              <Shield className="mr-2 h-4 w-4" />
              Tresor einrichten
            </Button>
          )}
          {vaultEnabled && (
            <Button onClick={() => { setMode("change"); setError(null); setSuccess(false); }} variant="outline" size="sm">
              Tresor-Passwort ändern
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (mode === "setup") {
    return (
      <form onSubmit={handleSetup} className="space-y-4">
        <p className="text-sm text-slate-600">
          Wählen Sie ein sicheres Tresor-Passwort. Dieses Passwort können wir{" "}
          <strong>nicht zurücksetzen</strong> — bewahren Sie es sicher auf.
        </p>
        <PasswordField
          id="vault-pw"
          name="password"
          label="Tresor-Passwort"
          autoComplete="new-password"
          showStrength
        />
        <PasswordField
          id="vault-confirm"
          name="confirm"
          label="Bestätigen"
          autoComplete="new-password"
          showToggle={false}
        />
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Tresor einrichten
          </Button>
          <Button type="button" variant="outline" onClick={() => setMode("idle")}>Abbrechen</Button>
        </div>
      </form>
    );
  }

  // mode === "change"
  return (
    <form onSubmit={handleChange} className="space-y-4">
      <PasswordField
        id="vault-old"
        name="oldPassword"
        label="Aktuelles Tresor-Passwort"
        autoComplete="current-password"
        showToggle={false}
      />
      <PasswordField
        id="vault-new"
        name="newPassword"
        label="Neues Tresor-Passwort"
        autoComplete="new-password"
        showStrength
      />
      <PasswordField
        id="vault-confirm2"
        name="confirm"
        label="Bestätigen"
        autoComplete="new-password"
        showToggle={false}
      />
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Passwort ändern
        </Button>
        <Button type="button" variant="outline" onClick={() => setMode("idle")}>Abbrechen</Button>
      </div>
    </form>
  );
}
