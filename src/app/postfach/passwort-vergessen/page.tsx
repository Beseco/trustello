"use client";

import { useState, useTransition } from "react";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestCitizenPasswordReset } from "@/server/actions/citizen-account";
import Link from "next/link";

export default function PasswortVergessenPage() {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    startTransition(async () => {
      await requestCitizenPasswordReset(email.trim().toLowerCase());
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-sm space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <h1 className="text-xl font-semibold text-slate-900">E-Mail gesendet</h1>
          <p className="text-sm text-slate-500">
            Falls ein Konto mit dieser E-Mail-Adresse existiert, erhalten Sie in Kürze einen Link zum Zurücksetzen Ihres Passworts. Der Link ist 2 Stunden gültig.
          </p>
          <Link href="/postfach/login" className="text-sm text-blue-600 hover:underline">
            Zurück zur Anmeldung
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Mail className="mx-auto mb-3 h-10 w-10 text-blue-600" />
          <h1 className="text-xl font-semibold text-slate-900">Passwort zurücksetzen</h1>
          <p className="mt-1 text-sm text-slate-500">
            Geben Sie Ihre E-Mail-Adresse ein. Wir senden Ihnen einen Link zum Zurücksetzen.
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">E-Mail-Adresse</Label>
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
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reset-Link senden
            </Button>
          </form>
        </div>
        <p className="text-center">
          <Link href="/postfach/login" className="text-sm text-blue-600 hover:underline">
            Zurück zur Anmeldung
          </Link>
        </p>
      </div>
    </div>
  );
}
