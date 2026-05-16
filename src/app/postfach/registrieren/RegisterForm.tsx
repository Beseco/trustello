"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerCitizenAccount } from "@/server/actions/citizen-account";

export function RegisterForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    data.set("token", token);

    startTransition(async () => {
      const result = await registerCitizenAccount(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Auto-Login nach Registrierung
      await signIn("citizen-account-credentials", {
        email,
        password: data.get("password") as string,
        redirect: false,
      });
      router.push("/postfach/profil?welcome=1");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
        Konto für: <strong>{email}</strong>
      </div>

      <div>
        <Label htmlFor="password">Passwort wählen</Label>
        <div className="relative mt-1">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Mindestens 10 Zeichen"
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
        <p className="mt-1 text-xs text-slate-400">
          Mind. 10 Zeichen · 1 Großbuchstabe · 1 Ziffer · 1 Sonderzeichen
        </p>
      </div>

      <div>
        <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Passwort wiederholen"
          className="mt-1"
          required
        />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
        Konto erstellen & anmelden
      </Button>
    </form>
  );
}
