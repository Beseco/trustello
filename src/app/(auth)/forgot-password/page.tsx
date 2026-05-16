"use client";

import { useState, useTransition } from "react";
import { AuthLayout } from "@/components/shared/AuthLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/server/actions/password-reset";
import { Loader2, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await requestPasswordReset(email);
      setDone(true);
    });
  }

  return (
    <AuthLayout
      title="Passwort vergessen"
      description="Wir senden Ihnen einen Link zum Zurücksetzen Ihres Passworts."
    >
      {done ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle className="h-10 w-10 text-green-500" />
          <p className="font-medium">E-Mail gesendet</p>
          <p className="text-sm text-muted-foreground">
            Falls ein Konto mit dieser Adresse existiert, erhalten Sie in Kürze eine E-Mail mit
            einem Link zum Zurücksetzen Ihres Passworts.
          </p>
          <Link href="/login" className="mt-2 text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground">
            Zurück zur Anmeldung
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-Mail-Adresse</Label>
            <Input
              id="email"
              type="email"
              placeholder="vorname.nachname@behoerde.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Link anfordern
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
              Zurück zur Anmeldung
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
