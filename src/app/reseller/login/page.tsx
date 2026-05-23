"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff, ChevronDown, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function ResellerLoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showTotp, setShowTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setError(null);

    startTransition(async () => {
      // CSRF-Token holen (NextAuth-Requirement)
      const { csrfToken } = await fetch("/api/auth/csrf").then(
        (r) => r.json() as Promise<{ csrfToken: string }>,
      );

      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/api/auth/callback/reseller-credentials";

      const fields: Record<string, string> = {
        email: email.trim().toLowerCase(),
        password,
        totpCode: totpCode.replace(/\s/g, ""),
        _ip: "",
        csrfToken,
        callbackUrl: "/reseller",
      };

      for (const [name, value] of Object.entries(fields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 shadow-lg">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Reseller-Portal</h1>
          <p className="mt-1 text-sm text-slate-500">Melden Sie sich mit Ihrem Reseller-Konto an</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-slate-700">
                E-Mail-Adresse
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="reseller@beispiel.de"
                className="mt-1"
                autoFocus
                required
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-slate-700">
                Passwort
              </Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Passwort eingeben"
                  required
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowTotp((v) => !v)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${showTotp ? "rotate-180" : ""}`}
              />
              2-Faktor-Authentifizierung
            </button>

            {showTotp && (
              <div>
                <Label htmlFor="totp" className="text-slate-700">
                  Authenticator-Code
                </Label>
                <Input
                  id="totp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="123 456"
                  maxLength={7}
                  className="mt-1 tracking-widest"
                />
              </div>
            )}

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <div className="text-right">
              <a
                href="/reseller/passwort-vergessen"
                className="text-xs text-slate-500 underline underline-offset-4 hover:text-slate-700"
              >
                Passwort vergessen?
              </a>
            </div>

            <Button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800"
              disabled={isPending}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Anmelden
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400">
          Mitarbeiter-Login:{" "}
          <a href="/login" className="text-slate-500 hover:underline">
            /login
          </a>
        </p>
      </div>
    </div>
  );
}
