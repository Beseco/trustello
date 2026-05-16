"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertCircle, Wifi, Eye, EyeOff, Trash2 } from "lucide-react";
import type { SmtpConfigData, SmtpFormValues, SmtpResult, SmtpTestResult } from "@/server/actions/smtp-settings";

const schema = z.object({
  host: z.string().min(1, "Host ist erforderlich"),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.boolean(),
  user: z.string().optional(),
  password: z.string().optional(),
  fromEmail: z.string().email("Ungültige E-Mail-Adresse"),
  fromName: z.string().optional(),
});

type Props = {
  initial: SmtpConfigData | null;
  onSave: (values: SmtpFormValues) => Promise<SmtpResult>;
  onTest: (values: SmtpFormValues) => Promise<SmtpTestResult>;
  onDelete?: () => Promise<SmtpResult>;
  fallbackLabel?: string; // z.B. "Reseller-SMTP" oder "System-Standard"
};

export function SmtpForm({ initial, onSave, onTest, onDelete, fallbackLabel = "System-Standard" }: Props) {
  const [savePending, startSave] = useTransition();
  const [testPending, startTest] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [saveResult, setSaveResult] = useState<SmtpResult | null>(null);
  const [testResult, setTestResult] = useState<SmtpTestResult | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<SmtpFormValues, unknown, SmtpFormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      host: initial?.host ?? "",
      port: initial?.port ?? 587,
      secure: initial?.secure ?? false,
      user: initial?.user ?? "",
      password: "",
      fromEmail: initial?.fromEmail ?? "",
      fromName: initial?.fromName ?? "",
    },
  });

  function handleSave(values: SmtpFormValues): void {
    setSaveResult(null);
    setTestResult(null);
    startSave(async () => {
      const result = await onSave(values);
      setSaveResult(result);
    });
  }

  function handleTest() {
    setTestResult(null);
    const values = form.getValues();
    startTest(async () => {
      const result = await onTest(values);
      setTestResult(result);
    });
  }

  function handleDelete() {
    if (!onDelete) return;
    if (!confirm(`Eigene SMTP-Konfiguration löschen? Es wird dann wieder der ${fallbackLabel} verwendet.`)) return;
    startDelete(async () => {
      const result = await onDelete();
      if (result.ok) {
        form.reset({ host: "", port: 587, secure: false, user: "", password: "", fromEmail: "", fromName: "" });
        setSaveResult({ ok: true });
      } else {
        setSaveResult(result);
      }
    });
  }

  const hasExistingPassword = initial?.hasPassword && !form.watch("password");

  return (
    <form onSubmit={form.handleSubmit(handleSave)} className="space-y-5">
      {/* Status Banner */}
      {initial ? (
        <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Eigene SMTP-Konfiguration aktiv
        </div>
      ) : (
        <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          Kein eigener SMTP konfiguriert — es wird <strong>{fallbackLabel}</strong> verwendet.
        </div>
      )}

      {/* Server */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Label htmlFor="smtp-host">SMTP-Server</Label>
          <Input
            id="smtp-host"
            placeholder="mail.example.de"
            className="mt-1"
            {...form.register("host")}
          />
          {form.formState.errors.host && (
            <p className="mt-1 text-xs text-destructive">{form.formState.errors.host.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="smtp-port">Port</Label>
          <Input
            id="smtp-port"
            type="number"
            placeholder="587"
            className="mt-1"
            {...form.register("port")}
          />
        </div>
      </div>

      {/* TLS */}
      <div className="flex items-center gap-2">
        <input
          id="smtp-secure"
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300"
          {...form.register("secure")}
        />
        <Label htmlFor="smtp-secure" className="cursor-pointer">
          SSL/TLS (Port 465) — deaktiviert für STARTTLS (Port 587/25)
        </Label>
      </div>

      {/* Auth */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="smtp-user">Benutzername</Label>
          <Input
            id="smtp-user"
            placeholder="user@example.de"
            autoComplete="username"
            className="mt-1"
            {...form.register("user")}
          />
        </div>
        <div>
          <Label htmlFor="smtp-password">
            Passwort
            {hasExistingPassword && (
              <span className="ml-2 text-xs text-muted-foreground">(gesetzt — leer lassen um zu behalten)</span>
            )}
          </Label>
          <div className="relative mt-1">
            <Input
              id="smtp-password"
              type={showPassword ? "text" : "password"}
              placeholder={hasExistingPassword ? "••••••••" : "Passwort eingeben"}
              autoComplete="new-password"
              {...form.register("password")}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Absender */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="smtp-from-email">Absender-E-Mail</Label>
          <Input
            id="smtp-from-email"
            type="email"
            placeholder="noreply@stadt-freising.de"
            className="mt-1"
            {...form.register("fromEmail")}
          />
          {form.formState.errors.fromEmail && (
            <p className="mt-1 text-xs text-destructive">{form.formState.errors.fromEmail.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="smtp-from-name">Absender-Name (optional)</Label>
          <Input
            id="smtp-from-name"
            placeholder="Stadt Freising"
            className="mt-1"
            {...form.register("fromName")}
          />
        </div>
      </div>

      {/* Feedback */}
      {saveResult && (
        <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${saveResult.ok ? "bg-green-50 text-green-700" : "bg-destructive/10 text-destructive"}`}>
          {saveResult.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {saveResult.ok ? "Einstellungen gespeichert." : saveResult.error}
        </div>
      )}
      {testResult && (
        <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${testResult.ok ? "bg-green-50 text-green-700" : "bg-destructive/10 text-destructive"}`}>
          {testResult.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {testResult.ok ? "Verbindung erfolgreich! SMTP-Server ist erreichbar." : `Verbindung fehlgeschlagen: ${testResult.error}`}
        </div>
      )}

      {/* Buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="submit" disabled={savePending}>
          {savePending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Speichern
        </Button>
        <Button type="button" variant="outline" onClick={handleTest} disabled={testPending}>
          {testPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wifi className="mr-2 h-4 w-4" />}
          Verbindung testen
        </Button>
        {onDelete && initial && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            disabled={deletePending}
          >
            {deletePending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-2 h-3.5 w-3.5" />}
            Zurück zu {fallbackLabel}
          </Button>
        )}
      </div>
    </form>
  );
}
