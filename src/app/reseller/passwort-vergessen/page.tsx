"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, Loader2, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "@/server/actions/password-reset";
import Link from "next/link";

export default function ResellerForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await requestPasswordReset(email, "reseller");
      setDone(true);
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 shadow-lg">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Passwort vergessen</h1>
          <p className="mt-1 text-sm text-slate-500">
            Wir senden Ihnen einen Reset-Link an Ihre E-Mail-Adresse.
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <CheckCircle className="h-10 w-10 text-green-500" />
              <p className="font-medium text-slate-800">E-Mail gesendet</p>
              <p className="text-sm text-slate-500">
                Falls ein Reseller-Konto mit dieser Adresse existiert, erhalten Sie in Kürze
                eine E-Mail mit einem Reset-Link.
              </p>
              <Link
                href="/reseller/login"
                className="mt-2 text-sm text-slate-500 underline underline-offset-4 hover:text-slate-700"
              >
                Zurück zur Anmeldung
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-slate-700">
                  E-Mail-Adresse
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="reseller@beispiel.de"
                  autoComplete="email"
                  autoFocus
                  required
                  className="mt-1"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800"
                disabled={pending}
              >
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset-Link senden
              </Button>

              <p className="text-center text-sm text-slate-500">
                <Link
                  href="/reseller/login"
                  className="underline underline-offset-4 hover:text-slate-700"
                >
                  Zurück zur Anmeldung
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
