"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthLayout } from "@/components/shared/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";

export function LoginForm() {
  const searchParams = useSearchParams();
  // Fehlermeldung aus URL-Param (nach Redirect von NextAuth bei falschen Credentials)
  const urlError = searchParams.get("error");

  const [submitting, setSubmitting] = useState(false);
  const [showTotp, setShowTotp] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", totpCode: "" },
  });

  async function onSubmit(data: LoginInput) {
    setSubmitting(true);

    // CSRF-Token holen (NextAuth-Requirement)
    const { csrfToken } = await fetch("/api/auth/csrf").then(
      (r) => r.json() as Promise<{ csrfToken: string }>,
    );

    // Nativer Form-Submit: Browser setzt Cookie und folgt Redirect korrekt
    const nativeForm = document.createElement("form");
    nativeForm.method = "POST";
    nativeForm.action = "/api/auth/callback/employee-credentials";

    const fields: Record<string, string> = {
      email: data.email,
      password: data.password,
      totpCode: data.totpCode ?? "",
      _ip: "",
      csrfToken,
      callbackUrl: "/admin",
    };

    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      nativeForm.appendChild(input);
    }

    document.body.appendChild(nativeForm);
    nativeForm.submit();
    // Browser navigiert jetzt zu /admin (Erfolg) oder /login?error=... (Fehler)
  }

  const errorMessage = urlError
    ? "Ungültige Anmeldedaten. Bitte prüfen Sie E-Mail und Passwort."
    : null;

  return (
    <AuthLayout title="Anmelden" description="Melden Sie sich mit Ihrem Mitarbeiterkonto an">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-Mail-Adresse</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="vorname.nachname@behoerde.de"
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Passwort</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Passwort eingeben"
                    autoComplete="current-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <button
            type="button"
            onClick={() => setShowTotp((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {showTotp ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            2-Faktor-Authentifizierung
          </button>

          {showTotp && (
            <FormField
              control={form.control}
              name="totpCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>2FA-Code</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="123456"
                      autoComplete="one-time-code"
                      maxLength={6}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {errorMessage && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </p>
          )}

          <div className="text-right">
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Passwort vergessen?
            </Link>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={submitting || form.formState.isSubmitting}
          >
            {(submitting || form.formState.isSubmitting) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Anmelden
          </Button>
        </form>
      </Form>

      <div className="text-center text-sm text-muted-foreground">
        <span>
          Noch kein Konto?{" "}
          <Link
            href="/register"
            className="font-medium underline underline-offset-4 hover:text-foreground"
          >
            Jetzt registrieren
          </Link>
        </span>
      </div>
    </AuthLayout>
  );
}
