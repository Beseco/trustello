"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";

type Props = { slug: string; tenantName: string };

export function CitizenLoginForm({ slug }: Props) {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [showTotp, setShowTotp] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const { csrfToken } = await fetch("/api/auth/csrf").then(
      (r) => r.json() as Promise<{ csrfToken: string }>,
    );

    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/auth/callback/customer-credentials";

    const fields: Record<string, string> = {
      email,
      password,
      totpCode,
      tenantSlug: slug,
      _ip: "",
      csrfToken,
      callbackUrl: `/portal/${slug}/dashboard`,
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
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">E-Mail-Adresse</Label>
        <Input
          id="email"
          type="email"
          placeholder="ihre@email.de"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="password">Passwort</Label>
        <Input
          id="password"
          type="password"
          placeholder="Passwort eingeben"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mt-1"
        />
      </div>

      {/* 2FA-Toggle */}
      {!showTotp ? (
        <button
          type="button"
          onClick={() => setShowTotp(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          2FA-Code eingeben
        </button>
      ) : (
        <div>
          <Label htmlFor="totp">Authenticator-Code (6-stellig)</Label>
          <Input
            id="totp"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            autoComplete="one-time-code"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
            className="mt-1 font-mono tracking-widest"
          />
        </div>
      )}

      {urlError && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Ungültige Anmeldedaten. Falls Sie 2FA aktiviert haben, geben Sie bitte auch Ihren
          Authenticator-Code ein.
        </p>
      )}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Anmelden
      </Button>
    </form>
  );
}
