"use client";

import { useState, useRef, useTransition } from "react";
import { verifyPinByEmail } from "@/server/actions/pin-letter";
import { CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";

export function PinVerifyForm() {
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tenantSlug, setTenantSlug] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  const pin = digits.join("");
  const isComplete = pin.length === 6 && /^\d{6}$/.test(pin);

  function handleDigitChange(i: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = digit;
      return next;
    });
    if (digit && i < 5) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      setDigits(pasted.split("").concat(Array(6 - pasted.length).fill("")));
      refs.current[Math.min(pasted.length, 5)]?.focus();
      e.preventDefault();
    }
  }

  function handleSubmit() {
    if (!isComplete || !email.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await verifyPinByEmail(email.trim().toLowerCase(), pin);
      if (result.ok) {
        setSuccess(true);
        if ("tenantSlug" in result) setTenantSlug(result.tenantSlug);
      } else {
        setError(result.error);
      }
    });
  }

  if (success) {
    return (
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">Konto verifiziert!</h2>
          <p className="text-sm text-slate-500">
            Ihre Identität wurde erfolgreich bestätigt.
          </p>
        </div>
        {tenantSlug ? (
          <Link
            href={`/portal/${tenantSlug}`}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Zum Portal
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <p className="text-xs text-slate-400">Sie können dieses Fenster jetzt schließen.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* E-Mail */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">
          Ihre E-Mail-Adresse
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="max.mustermann@example.de"
          autoComplete="email"
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        <p className="text-xs text-slate-400">
          Die E-Mail-Adresse, an die der Brief adressiert ist
        </p>
      </div>

      {/* 6-Ziffern-PIN */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">
          Zugangscode aus dem Brief
        </label>
        <div className="flex items-center gap-2 justify-center" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { refs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`
                h-12 w-10 rounded-lg border text-center text-xl font-bold focus:outline-none focus:ring-2
                ${digit ? "border-slate-400 bg-slate-50" : "border-slate-200 bg-white"}
                text-slate-900 focus:ring-slate-400
                ${i === 2 ? "mr-2" : ""}
              `}
            />
          ))}
        </div>
        <p className="text-center text-xs text-slate-400">
          Code einfügen (Strg+V / ⌘+V) oder Ziffern einzeln eingeben
        </p>
      </div>

      {/* Fehler */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!isComplete || !email.trim() || isPending}
        className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Konto verifizieren
      </button>

      <p className="text-center text-xs text-slate-400">
        Der Zugangscode ist 30 Tage ab Versanddatum gültig.
      </p>
    </div>
  );
}
