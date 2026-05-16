"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { createCustomer } from "@/server/actions/customers";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useState } from "react";

const schema = z.object({
  salutation: z.string().optional(),
  firstName: z.string().min(1, "Pflichtfeld"),
  lastName: z.string().min(1, "Pflichtfeld"),
  email: z.string().email("Ungültige E-Mail"),
  mobilePhone: z.string().optional(),
  street: z.string().optional(),
  zipCode: z.string().optional(),
  city: z.string().optional(),
  visibility: z.enum(["PRIVATE", "ORGANISATION", "OU"]),
});
type FormData = z.infer<typeof schema>;

export function NewCustomerForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      salutation: "",
      firstName: "",
      lastName: "",
      email: "",
      mobilePhone: "",
      street: "",
      zipCode: "",
      city: "",
      visibility: "PRIVATE",
    },
  });

  async function onSubmit(data: FormData) {
    setServerError(null);
    const result = await createCustomer(data);
    if (result.error) {
      setServerError(result.error);
    } else {
      router.push("/customers");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="salutation" render={({ field }) => (
            <FormItem>
              <FormLabel>Anrede</FormLabel>
              <FormControl>
                <select {...field} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="">—</option>
                  <option>Herr</option>
                  <option>Frau</option>
                  <option>Divers</option>
                </select>
              </FormControl>
            </FormItem>
          )} />

          <div /> {/* spacer */}

          <FormField control={form.control} name="firstName" render={({ field }) => (
            <FormItem>
              <FormLabel>Vorname *</FormLabel>
              <FormControl><Input placeholder="Max" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="lastName" render={({ field }) => (
            <FormItem>
              <FormLabel>Nachname *</FormLabel>
              <FormControl><Input placeholder="Mustermann" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>E-Mail *</FormLabel>
              <FormControl><Input type="email" placeholder="max@beispiel.de" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="mobilePhone" render={({ field }) => (
            <FormItem>
              <FormLabel>Mobilnummer</FormLabel>
              <FormControl><Input placeholder="+49 151 …" {...field} /></FormControl>
            </FormItem>
          )} />

          <div /> {/* spacer */}

          <FormField control={form.control} name="street" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Straße & Hausnummer</FormLabel>
              <FormControl><Input placeholder="Musterstraße 1" {...field} /></FormControl>
            </FormItem>
          )} />

          <FormField control={form.control} name="zipCode" render={({ field }) => (
            <FormItem>
              <FormLabel>PLZ</FormLabel>
              <FormControl><Input placeholder="12345" {...field} /></FormControl>
            </FormItem>
          )} />

          <FormField control={form.control} name="city" render={({ field }) => (
            <FormItem>
              <FormLabel>Ort</FormLabel>
              <FormControl><Input placeholder="Musterstadt" {...field} /></FormControl>
            </FormItem>
          )} />

          <FormField control={form.control} name="visibility" render={({ field }) => (
            <FormItem>
              <FormLabel>Sichtbarkeit</FormLabel>
              <FormControl>
                <select {...field} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="PRIVATE">Privat (nur ich)</option>
                  <option value="ORGANISATION">Organisation</option>
                  <option value="OU">Organisationseinheit</option>
                </select>
              </FormControl>
            </FormItem>
          )} />
        </div>

        {serverError && (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{serverError}</p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Kunde anlegen
          </button>
          <Link href="/customers" className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
            Abbrechen
          </Link>
        </div>
      </form>
    </Form>
  );
}
