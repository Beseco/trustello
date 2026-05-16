"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Loader2, ShieldCheck, ShieldOff, Copy, Check } from "lucide-react";
import { generateTotpSecret, enableTotp, disableTotp } from "@/server/actions/totp-setup";
import { Input } from "@/components/ui/input";

type Props = { totpEnabled: boolean };

type Step = "idle" | "setup" | "confirm";

export function TotpSetup({ totpEnabled }: Props) {
  const [step, setStep] = useState<Step>("idle");
  const [secret, setSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [code, setCode] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  // QR-Code lokal im Browser rendern (kein externer Dienst)
  useEffect(() => {
    if (step === "setup" && otpauthUrl && canvasRef.current) {
      import("qrcode").then((QRCode) => {
        QRCode.toCanvas(canvasRef.current!, otpauthUrl, { width: 180, margin: 1 });
      });
    }
  }, [step, otpauthUrl]);

  function handleStartSetup() {
    setError(null);
    startTransition(async () => {
      const result = await generateTotpSecret();
      setSecret(result.secret);
      setOtpauthUrl(result.otpauthUrl);
      setStep("setup");
    });
  }

  function copySecret() {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleEnable() {
    if (!code.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await enableTotp(secret, code.trim(), password);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setStep("idle");
        setTimeout(() => setSuccess(false), 3000);
      }
    });
  }

  function handleDisable() {
    if (!password.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await disableTotp(password);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setPassword("");
        setStep("idle");
        setTimeout(() => setSuccess(false), 3000);
      }
    });
  }

  // --- Deaktivieren ---
  if (totpEnabled && !success) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
          <ShieldCheck className="h-4 w-4" />
          <span className="font-medium">Zwei-Faktor-Authentifizierung ist aktiviert</span>
        </div>

        {step === "idle" ? (
          <button
            onClick={() => { setStep("confirm"); setError(null); }}
            className="inline-flex items-center gap-2 rounded-md border border-destructive/50 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
          >
            <ShieldOff className="h-4 w-4" />
            2FA deaktivieren
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Geben Sie Ihr Passwort ein, um 2FA zu deaktivieren:
            </p>
            <Input
              type="password"
              placeholder="Ihr Passwort"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="max-w-xs"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleDisable}
                disabled={isPending || !password.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Deaktivieren
              </button>
              <button
                onClick={() => { setStep("idle"); setPassword(""); setError(null); }}
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

  // --- Aktivieren ---
  return (
    <div className="space-y-4">
      {success && (
        <p className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
          <ShieldCheck className="h-4 w-4" />
          {totpEnabled ? "2FA wurde deaktiviert" : "2FA erfolgreich aktiviert ✓"}
        </p>
      )}

      {step === "idle" && !success && (
        <>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldOff className="h-4 w-4" />
            Zwei-Faktor-Authentifizierung ist nicht aktiviert
          </p>
          <button
            onClick={handleStartSetup}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            2FA einrichten
          </button>
        </>
      )}

      {step === "setup" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Scannen Sie den QR-Code mit Ihrer Authenticator-App (z.B. Google Authenticator, Bitwarden, Aegis):
          </p>

          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start">
            {/* QR-Code — lokal im Browser gerendert, kein externer Dienst */}
            <div className="rounded-lg border bg-white p-2">
              <canvas ref={canvasRef} width={180} height={180} />
            </div>

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Oder geben Sie den Code manuell ein:
              </p>
              <div className="flex items-center gap-2">
                <code className="rounded bg-muted px-2 py-1 font-mono text-xs tracking-widest">
                  {secret.match(/.{1,4}/g)?.join(" ")}
                </code>
                <button
                  onClick={copySecret}
                  className="text-muted-foreground hover:text-foreground"
                  title="Kopieren"
                >
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <button
                onClick={() => setStep("confirm")}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Weiter
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "confirm" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Geben Sie den 6-stelligen Code aus Ihrer App ein, um die Einrichtung zu bestätigen:
          </p>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="123 456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="max-w-[160px] font-mono text-lg tracking-widest"
            autoFocus
          />
          <Input
            type="password"
            placeholder="Ihr Passwort zur Bestätigung"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="max-w-xs"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleEnable}
              disabled={isPending || code.length < 6 || !password.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Bestätigen & aktivieren
            </button>
            <button
              onClick={() => { setStep("idle"); setCode(""); setPassword(""); setError(null); }}
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
