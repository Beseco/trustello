"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetCitizenPassword } from "@/server/actions/citizen-account";
import Link from "next/link";
import { Suspense } from "react";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-slate-600">Kein gültiger Reset-Token. Bitte fordern Sie einen neuen Link an.</p>
        <Link href="/postfach/passwort-vergessen" className="mt-3 block text-sm text-blue-600 hover:underline">
          Neuen Link anfordern
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-500" />
        <p className="font-semibold text-slate-900">Passwort geändert</p>
        <Link href="/postfach/login" className="mt-3 block text-sm text-blue-600 hover:underline">
          Jetzt anmelden
        </Link>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const confirm = (e.currentTarget.elements.namedItem("confirm") as HTMLInputElement).value;
    if (password !== confirm) { setError("Passwörter stimmen nicht überein"); return; }
    setError(null);
    startTransition(async () => {
      const result = await resetCitizenPassword(token, password);
      if (!result.ok) { setError(result.error); return; }
      setSuccess(true);
      setTimeout(() => router.push("/postfach/login"), 2000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="password">Neues Passwort</Label>
        <div className="relative mt-1">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mindestens 10 Zeichen"
            required
          />
          <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">Mind. 10 Zeichen · 1 Großbuchstabe · 1 Ziffer · 1 Sonderzeichen</p>
      </div>
      <div>
        <Label htmlFor="confirm">Passwort bestätigen</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" className="mt-1" required />
      </div>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Passwort speichern
      </Button>
    </form>
  );
}

export default function PasswortResetPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-center text-xl font-semibold text-slate-900">Neues Passwort setzen</h1>
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <Suspense fallback={<p className="text-center text-sm text-slate-400">Lädt…</p>}>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
