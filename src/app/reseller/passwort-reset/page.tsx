"use client";

import { useState, useTransition, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ShieldCheck, Loader2, CheckCircle, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { resetPassword, validateResetToken } from "@/server/actions/password-reset";
import Link from "next/link";

function ResetForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [tokenValid, setTokenValid] = useState<boolean | null>(!token ? false : null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!token) return; validateResetToken(token).then(({ valid }) => setTokenValid(valid));
  }, [token]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await resetPassword({ token, password });
      if (result.error) {
        setError(result.error);
      } else {
        setDone(true);
        setTimeout(() => router.push("/reseller/login"), 3000);
      }
    });
  }

  if (tokenValid === null) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <p className="font-medium text-slate-800">Link ungültig oder abgelaufen</p>
        <p className="text-sm text-slate-500">Bitte fordern Sie einen neuen Link an.</p>
        <Link
          href="/reseller/passwort-vergessen"
          className="mt-2 text-sm text-slate-500 underline underline-offset-4 hover:text-slate-700"
        >
          Neuen Link anfordern
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <CheckCircle className="h-10 w-10 text-green-500" />
        <p className="font-medium text-slate-800">Passwort erfolgreich geändert</p>
        <p className="text-sm text-slate-500">Sie werden zur Anmeldung weitergeleitet…</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="password" className="text-slate-700">
          Neues Passwort
        </Label>
        <div className="relative mt-1">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Mindestens 8 Zeichen, Großbuchstabe, Zahl"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            autoFocus
            className="pr-10"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <Button
        type="submit"
        className="w-full bg-slate-900 hover:bg-slate-800"
        disabled={pending}
      >
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Passwort speichern
      </Button>
    </form>
  );
}

export default function ResellerPasswordResetPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 shadow-lg">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Neues Passwort</h1>
          <p className="mt-1 text-sm text-slate-500">
            Wählen Sie ein sicheres neues Passwort für Ihr Reseller-Konto.
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <Suspense
            fallback={
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            }
          >
            <ResetForm />
          </Suspense>
        </div>

        <p className="text-center text-xs text-slate-400">
          <Link href="/reseller/login" className="hover:underline">
            ← Zurück zur Anmeldung
          </Link>
        </p>
      </div>
    </div>
  );
}
