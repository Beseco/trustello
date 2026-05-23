"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  ShieldCheck,
  ShieldOff,
  ChevronRight,
  CheckCircle2,
  Copy,
  Check,
} from "lucide-react";
import {
  generateCitizenTotpSecret,
  enableCitizenTotp,
  disableCitizenTotp,
} from "@/server/actions/citizen-profile";
import QRCode from "qrcode";
import { useEffect, useRef } from "react";

type Props = { totpEnabled: boolean };

// ── QR-Code Canvas ─────────────────────────────────────────────────────────────
function QrCanvas({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current && url) {
      QRCode.toCanvas(canvasRef.current, url, { width: 200, margin: 1 });
    }
  }, [url]);
  return <canvas ref={canvasRef} className="rounded-lg border" />;
}

// ── Disable TOTP Form ──────────────────────────────────────────────────────────
function DisableTotpForm({ onDisabled }: { onDisabled: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [open, setOpen] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await disableCitizenTotp(code, password);
      if (!result.ok) {
        setError(result.error);
      } else {
        onDisabled();
      }
    });
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ShieldOff className="mr-2 h-4 w-4" />
        2FA deaktivieren
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
    >
      <p className="text-sm font-medium text-destructive">2FA deaktivieren</p>
      <div>
        <Label htmlFor="dis-code" className="text-xs">
          Aktueller 6-stelliger Code
        </Label>
        <Input
          id="dis-code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="mt-1 font-mono tracking-widest"
          required
        />
      </div>
      <div>
        <Label htmlFor="dis-pw" className="text-xs">
          Ihr Passwort zur Bestätigung
        </Label>
        <Input
          id="dis-pw"
          type="password"
          placeholder="Passwort eingeben"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1"
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" size="sm" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Deaktivieren
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

// ── Enable TOTP Flow ────────────────────────────────────────────────────────────
type Step = "idle" | "scan" | "verify" | "done";

function EnableTotpFlow({ onEnabled }: { onEnabled: () => void }) {
  const [step, setStep] = useState<Step>("idle");
  const [isPending, startTransition] = useTransition();
  const [secret, setSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function startSetup() {
    startTransition(async () => {
      const result = await generateCitizenTotpSecret();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSecret(result.secret);
      setOtpauthUrl(result.otpauthUrl);
      setStep("scan");
    });
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await enableCitizenTotp(secret, code, password);
      if (!result.ok) {
        setError(result.error);
      } else {
        setStep("done");
        setTimeout(onEnabled, 1500);
      }
    });
  }

  function copySecret() {
    void navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (step === "idle") {
    return (
      <Button size="sm" onClick={startSetup} disabled={isPending}>
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ShieldCheck className="mr-2 h-4 w-4" />
        )}
        2FA einrichten
      </Button>
    );
  }

  if (step === "scan") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Scannen Sie den QR-Code mit Ihrer Authenticator-App (z. B. Google Authenticator, Authy).
        </p>
        <div className="flex flex-col items-center gap-3">
          <QrCanvas url={otpauthUrl} />
          <div className="flex items-center gap-2">
            <code className="rounded bg-muted px-2 py-1 text-xs font-mono tracking-wider">
              {secret}
            </code>
            <button
              type="button"
              onClick={copySecret}
              className="text-muted-foreground hover:text-foreground"
              title="Secret kopieren"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Alternativ: Secret manuell in die App eingeben
          </p>
        </div>
        <Button size="sm" onClick={() => setStep("verify")}>
          Weiter <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (step === "verify") {
    return (
      <form onSubmit={handleVerify} className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Geben Sie den aktuellen Code aus Ihrer App ein, um die Einrichtung abzuschließen.
        </p>
        <div>
          <Label htmlFor="totp-code" className="text-xs">
            6-stelliger Code
          </Label>
          <Input
            id="totp-code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="mt-1 font-mono tracking-widest"
            required
          />
        </div>
        <div>
          <Label htmlFor="totp-pw" className="text-xs">
            Ihr Passwort zur Bestätigung
          </Label>
          <Input
            id="totp-pw"
            type="password"
            placeholder="Passwort eingeben"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1"
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Aktivieren
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setStep("scan")}>
            Zurück
          </Button>
        </div>
      </form>
    );
  }

  // done
  return (
    <div className="flex items-center gap-2 text-sm text-green-700">
      <CheckCircle2 className="h-5 w-5" />
      2FA erfolgreich aktiviert!
    </div>
  );
}

// ── Main Card Content ──────────────────────────────────────────────────────────
export function TotpCard({ totpEnabled: initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);

  return (
    <div>
      {enabled ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <ShieldCheck className="h-5 w-5 shrink-0" />
            <span className="font-medium">Zwei-Faktor-Authentifizierung ist aktiv.</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Ihr Konto ist durch eine Authenticator-App geschützt. Beim Anmelden werden Sie nach
            einem 6-stelligen Code gefragt.
          </p>
          <DisableTotpForm onDisabled={() => setEnabled(false)} />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Schützen Sie Ihr Konto zusätzlich mit einer Authenticator-App. Nach der Aktivierung
            benötigen Sie bei jeder Anmeldung einen 6-stelligen Code.
          </p>
          <EnableTotpFlow onEnabled={() => setEnabled(true)} />
        </div>
      )}
    </div>
  );
}
