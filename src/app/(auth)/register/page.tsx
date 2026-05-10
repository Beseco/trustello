"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  FormDescription,
} from "@/components/ui/form";
import { registerEmployee } from "@/server/actions/auth";
import { registerEmployeeSchema, type RegisterEmployeeInput } from "@/lib/validation/auth";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<RegisterEmployeeInput>({
    resolver: zodResolver(registerEmployeeSchema),
    defaultValues: { salutation: "", firstName: "", lastName: "", email: "", password: "" },
  });

  async function onSubmit(data: RegisterEmployeeInput) {
    setError(null);
    const result = await registerEmployee(data);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    setTimeout(() => router.push("/login"), 3000);
  }

  if (success) {
    return (
      <AuthLayout title="Registrierung erfolgreich">
        <div className="flex flex-col items-center gap-4 py-4">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
          <p className="text-center text-sm text-muted-foreground">
            Ihr Konto wurde angelegt. Eine Bestätigungs-E-Mail wurde an Ihre Adresse geschickt.
            Sie werden in Kürze zur Anmeldung weitergeleitet.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Konto erstellen"
      description="Registrieren Sie sich mit Ihrer Dienst-E-Mail-Adresse"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vorname</FormLabel>
                  <FormControl>
                    <Input placeholder="Max" autoComplete="given-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nachname</FormLabel>
                  <FormControl>
                    <Input placeholder="Mustermann" autoComplete="family-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dienst-E-Mail</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="vorname.nachname@gemeinde.de"
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Ihre Behörde muss für die Selbstregistrierung freigeschaltet sein.
                </FormDescription>
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
                    placeholder="Mindestens 8 Zeichen"
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {error && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Konto erstellen
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        Bereits ein Konto?{" "}
        <Link href="/login" className="font-medium underline underline-offset-4 hover:text-foreground">
          Anmelden
        </Link>
      </p>
    </AuthLayout>
  );
}
