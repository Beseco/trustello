"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Shield, Loader2, CheckCircle2, AlertCircle, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  generateCitizenTotpSecret,
  enableCitizenTotp,
  disableCitizenTotp,
} from "@/server/actions/citizen-account";

export function TotpCard({ totpEnabled }: { totpEnabled: boolean }) {
  const [step, setStep] = useState<"idle" | "scan" | "verify">("idle");
  const [isPending, startTransition] = useTransition();
  const [secret, setSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (step === "scan" && otpauthUrl && canvasRef.current) {
      import("qrcode").then((QRCode) => {
        QRCode.toCanvas(canvasRef.current!, otpauthUrl, { width: 200, margin: 2 }).catch(() => {});
      });
    }
  }, [step, otpauthUrl]);

  function handleStart() {
    setError(null);
    startTransition(async () => {
      const r = await generateCitizenTotpSecret();
      if (!r.ok) { setError(r.error); return; }
      setSecret(r.secret);
      setOtpauthUrl(r.otpauthUrl);
      setStep("scan");
    });
  }

  function handleEnable(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const r = await enableCitizenTotp(secret, data.get("code") as string, data.get("password") as string);
      if (!r.ok) { setError(r.error); return; }
      setSuccess(true); setStep("idle");
    });
  }

  function handleDisable(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const r = await disableCitizenTotp(data.get("code") as string, data.get("password") as string);
      if (!r.ok) { setError(r.error); return; }
      setSuccess(true);
    });
  }

  if (success) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        {totpEnabled ? "2FA wurde deaktiviert." : "2FA erfolgreich aktiviert!"}
      </div>
    );
  }

  if (!totpEnabled) {
    if (step === "idle") {
      return (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Schützen Sie Ihr Konto mit einem Authenticator (Google Authenticator, Authy, etc.).
          </p>
          <Button onClick={handleStart} disabled={isPending} size="sm">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            2FA einrichten
          </Button>
        </div>
      );
    }

    if (step === "scan") {
      return (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Scannen Sie den QR-Code mit Ihrer Authenticator-App:</p>
          <canvas ref={canvasRef} className="rounded-lg border" />
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Oder geben Sie den Code manuell ein:</p>
            <div className="flex items-center gap-2">
              <code className="rounded bg-slate-100 px-2 py-1 text-xs tracking-widest">{secret}</code>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(secret); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="text-slate-400 hover:text-slate-700"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <Button size="sm" onClick={() => setStep("verify")}>Weiter →</Button>
        </div>
      );
    }

    return (
      <form onSubmit={handleEnable} className="space-y-4">
        <p className="text-sm text-slate-600">Geben Sie den Code aus Ihrer Authenticator-App ein:</p>
        <div>
          <Label htmlFor="totp-code">Authenticator-Code</Label>
          <Input id="totp-code" name="code" inputMode="numeric" maxLength={7} placeholder="123 456" className="mt-1 tracking-widest" required />
        </div>
        <div>
          <Label htmlFor="totp-pw">Ihr Passwort (zur Bestätigung)</Label>
          <Input id="totp-pw" name="password" type="password" autoComplete="current-password" className="mt-1" required />
        </div>
        {error && <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle className="h-4 w-4" />{error}</div>}
        <div className="flex gap-2">
          <Button type="submit" disabled={isPending} size="sm">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aktivieren
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setStep("idle")}>Abbrechen</Button>
        </div>
      </form>
    );
  }

  // totpEnabled === true → Deaktivieren
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
        <Shield className="h-4 w-4 shrink-0" />
        2-Faktor-Authentifizierung ist aktiv.
      </div>
      <form onSubmit={handleDisable} className="space-y-3">
        <div>
          <Label htmlFor="dis-code">Authenticator-Code</Label>
          <Input id="dis-code" name="code" inputMode="numeric" maxLength={7} placeholder="123 456" className="mt-1 tracking-widest" required />
        </div>
        <div>
          <Label htmlFor="dis-pw">Ihr Passwort</Label>
          <Input id="dis-pw" name="password" type="password" autoComplete="current-password" className="mt-1" required />
        </div>
        {error && <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle className="h-4 w-4" />{error}</div>}
        <Button type="submit" variant="destructive" size="sm" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          2FA deaktivieren
        </Button>
      </form>
    </div>
  );
}
