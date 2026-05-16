"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createTenant } from "@/server/actions/reseller-tenants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { Loader2, Plus } from "lucide-react";

const schema = z.object({
  name: z.string().min(2, "Mind. 2 Zeichen"),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Nur Kleinbuchstaben, Ziffern, Bindestriche"),
  billingEmail: z.string().email("Ungültige E-Mail"),
  planId: z.string().min(1, "Bitte wählen"),
  autoLoginDomains: z.string().optional(),
  status: z.enum(["TRIAL", "ACTIVE"]),
});
type FormData = z.infer<typeof schema>;

type Plan = { id: string; name: string; monthlyPrice: string };

export function CreateTenantDialog({ plans }: { plans: Plan[] }) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      slug: "",
      billingEmail: "",
      planId: "",
      autoLoginDomains: "",
      status: "TRIAL",
    },
  });

  async function onSubmit(data: FormData) {
    setServerError(null);
    const result = await createTenant(data);
    if (result.error) {
      setServerError(result.error);
    } else {
      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        form.reset();
      }, 1500);
    }
  }

  // Slug aus Name ableiten
  function handleNameBlur(value: string) {
    if (!form.getValues("slug")) {
      const slug = value
        .toLowerCase()
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      form.setValue("slug", slug);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Neuer Mandant
          </button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Neuen Mandanten anlegen</DialogTitle>
        </DialogHeader>

        {success ? (
          <p className="py-4 text-center text-sm text-green-600">Mandant wurde angelegt ✓</p>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name der Behörde / Organisation</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Stadt Musterstadt"
                        {...field}
                        onBlur={(e) => {
                          field.onBlur();
                          handleNameBlur(e.target.value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL-Slug (eindeutig)</FormLabel>
                    <FormControl>
                      <Input placeholder="stadt-musterstadt" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="billingEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rechnungs-E-Mail</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="it@musterstadt.de" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="planId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Wählen…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {plans.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} ({Number(p.monthlyPrice) === 0 ? "kostenlos" : `${p.monthlyPrice} €/Mo`})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="TRIAL">Trial (30 Tage)</SelectItem>
                          <SelectItem value="ACTIVE">Aktiv</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="autoLoginDomains"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Auto-Login-Domains (optional, kommagetrennt)</FormLabel>
                    <FormControl>
                      <Input placeholder="musterstadt.de, rathaus-musterstadt.de" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {serverError && (
                <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {serverError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {form.formState.isSubmitting && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Anlegen
                </button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
