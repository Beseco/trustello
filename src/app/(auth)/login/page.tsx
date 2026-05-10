"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
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

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showTotp, setShowTotp] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", totpCode: "" },
  });

  async function onSubmit(data: LoginInput) {
    setError(null);
    const result = await signIn("employee-credentials", {
      email: data.email,
      password: data.password,
      totpCode: data.totpCode ?? "",
      _ip: "",
      redirect: false,
    });

    if (result?.error) {
      setError("Ungültige Anmeldedaten. Bitte prüfen Sie E-Mail und Passwort.");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

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
                    placeholder="••••••••"
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

          {error && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Anmelden
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        Noch kein Konto?{" "}
        <Link
          href="/register"
          className="font-medium underline underline-offset-4 hover:text-foreground"
        >
          Jetzt registrieren
        </Link>
      </p>
    </AuthLayout>
  );
}
