"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { updateTenantSettings } from "@/server/actions/tenant-settings";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const schema = z.object({
  defaultSecurityLevel: z.enum(["LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4"]),
  defaultMinTrustLevel: z.enum(["NONE", "EMAIL", "SMS", "PIN_LETTER", "BAYERN_ID_S", "BAYERN_ID_H", "EID"]),
  allowCustomerReplyDefault: z.boolean(),
  allowSubjectEncryption: z.boolean(),
  allowEmployeeOUCreate: z.boolean(),
  retentionDaysOverride: z.number().int().min(1).max(3650).nullable(),
});

type FormData = z.infer<typeof schema>;

export function SettingsForm({ defaultValues }: { defaultValues: FormData }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  async function onSubmit(data: FormData) {
    setServerError(null);
    setSaved(false);
    const result = await updateTenantSettings(data);
    if (result.error) {
      setServerError(result.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="defaultSecurityLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Standard-Sicherheitsstufe</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="LEVEL_1">Stufe 1 — Standard</SelectItem>
                    <SelectItem value="LEVEL_2">Stufe 2 — Verschlüsselt (empfohlen)</SelectItem>
                    <SelectItem value="LEVEL_3">Stufe 3 — Passwortgeschützt</SelectItem>
                    <SelectItem value="LEVEL_4">Stufe 4 — Höchste Sicherheit</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="defaultMinTrustLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mindest-Vertrauensstufe</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="NONE">Keine</SelectItem>
                    <SelectItem value="EMAIL">E-Mail verifiziert</SelectItem>
                    <SelectItem value="SMS">SMS verifiziert</SelectItem>
                    <SelectItem value="PIN_LETTER">PIN-Brief</SelectItem>
                    <SelectItem value="BAYERN_ID_S">BayernID (Substantiell)</SelectItem>
                    <SelectItem value="BAYERN_ID_H">BayernID (Hoch)</SelectItem>
                    <SelectItem value="EID">eID</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="retentionDaysOverride"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Aufbewahrungsfrist (Tage, leer = Plan-Standard)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  max={3650}
                  placeholder="leer lassen für Plan-Standard"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : parseInt(e.target.value, 10))
                  }
                  className="max-w-xs"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3">
          <p className="text-sm font-medium">Optionen</p>
          {(
            [
              { name: "allowCustomerReplyDefault", label: "Antworten für Bürger standardmäßig erlauben" },
              { name: "allowSubjectEncryption", label: "Betreff-Verschlüsselung zulassen" },
              { name: "allowEmployeeOUCreate", label: "Mitarbeiter dürfen eigene OUs anlegen" },
            ] as const
          ).map(({ name, label }) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-4 w-4 rounded border-input"
                    />
                  </FormControl>
                  <FormLabel className="cursor-pointer font-normal">{label}</FormLabel>
                </FormItem>
              )}
            />
          ))}
        </div>

        {serverError && (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{serverError}</p>
        )}
        {saved && <p className="text-sm text-green-600">Einstellungen gespeichert ✓</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Speichern
          </button>
        </div>
      </form>
    </Form>
  );
}
