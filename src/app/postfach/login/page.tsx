"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Lock, Loader2, Eye, EyeOff, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function PostfachLoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showTotp, setShowTotp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setError(null);

    startTransition(async () => {
      const result = await signIn("citizen-account-credentials", {
        email: email.trim().toLowerCase(),
        password,
        totpCode: totpCode.replace(/\s/g, ""),
        redirect: false,
      });

      if (!result?.ok || result.error) {
        if (result?.error === "CredentialsSignin") {
          setError("E-Mail oder Passwort ist falsch. Bitte prüfen Sie auch Ihren 2FA-Code.");
        } else {
          setError("Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.");
        }
        return;
      }

      router.push("/postfach/inbox");
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 shadow-lg">
            <Lock className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Willkommen</h1>
          <p className="mt-1 text-sm text-slate-500">Melden Sie sich in Ihrem sicheren Postfach an</p>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-slate-700">E-Mail-Adresse</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ihre@email.de"
                className="mt-1"
                autoFocus
                required
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-slate-700">Passwort</Label>
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
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showTotp ? "rotate-180" : ""}`} />
              2-Faktor-Authentifizierung (optional)
            </button>

            {showTotp && (
              <div>
                <Label htmlFor="totp" className="text-slate-700">Authenticator-Code</Label>
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

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Anmelden
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link
              href="/postfach/passwort-vergessen"
              className="text-sm text-blue-600 hover:underline"
            >
              Passwort vergessen?
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400">
          Noch kein Konto?{" "}
          <span className="text-slate-500">Sie erhalten eine Einladungs-E-Mail, wenn eine Behörde Ihnen eine Nachricht sendet.</span>
        </p>
      </div>
    </div>
  );
}
