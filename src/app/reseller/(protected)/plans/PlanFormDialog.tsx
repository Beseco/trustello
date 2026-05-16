"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { createPlan, updatePlan, type PlanInput } from "@/server/actions/reseller-plans";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const schema = z.object({
  name: z.string().min(2, "Mind. 2 Zeichen"),
  monthlyPrice: z.coerce.number().min(0),
  setupFee: z.coerce.number().min(0),
  maxUsers: z.coerce.number().int().min(1),
  storageGB: z.coerce.number().int().min(1),
  maxFileSizeMB: z.coerce.number().int().min(1),
  retentionDays: z.coerce.number().int().min(1),
  hasOutlookAddin: z.boolean(),
  hasBayernID: z.boolean(),
  hasEID: z.boolean(),
  hasAPI: z.boolean(),
  isTrial: z.boolean(),
  trialDays: z.coerce.number().int().min(1).nullable(),
  active: z.boolean(),
});
type FormData = z.infer<typeof schema>;

const DEFAULTS: FormData = {
  name: "",
  monthlyPrice: 0,
  setupFee: 0,
  maxUsers: 50,
  storageGB: 10,
  maxFileSizeMB: 100,
  retentionDays: 90,
  hasOutlookAddin: false,
  hasBayernID: false,
  hasEID: false,
  hasAPI: false,
  isTrial: false,
  trialDays: null,
  active: true,
};

type Props =
  | { mode: "create" }
  | { mode: "edit"; planId: string; defaultValues: FormData };

export function PlanFormDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: props.mode === "edit" ? props.defaultValues : DEFAULTS,
  });

  const isTrial = form.watch("isTrial");

  async function onSubmit(data: FormData) {
    setServerError(null);
    const input: PlanInput = { ...data, trialDays: data.isTrial ? data.trialDays : null };
    const result =
      props.mode === "edit"
        ? await updatePlan(props.planId, input)
        : await createPlan(input);

    if (result.error) {
      setServerError(result.error);
    } else {
      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        if (props.mode === "create") form.reset(DEFAULTS);
      }, 1200);
    }
  }

  const trigger =
    props.mode === "create" ? (
      <button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        <Plus className="h-4 w-4" />
        Neuer Plan
      </button>
    ) : (
      <button className="inline-flex items-center gap-1 rounded p-1 text-muted-foreground hover:text-foreground">
        <Pencil className="h-4 w-4" />
      </button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{props.mode === "create" ? "Neuen Plan anlegen" : "Plan bearbeiten"}</DialogTitle>
        </DialogHeader>

        {success ? (
          <p className="py-4 text-center text-sm text-green-600">
            {props.mode === "create" ? "Plan angelegt ✓" : "Plan gespeichert ✓"}
          </p>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Plan-Name *</FormLabel>
                      <FormControl><Input placeholder="Business" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="monthlyPrice" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monatspreis (€)</FormLabel>
                    <FormControl><Input type="number" min={0} step={0.01} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="setupFee" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Einrichtungsgebühr (€)</FormLabel>
                    <FormControl><Input type="number" min={0} step={0.01} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="maxUsers" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max. Benutzer</FormLabel>
                    <FormControl><Input type="number" min={1} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="storageGB" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Speicher (GB)</FormLabel>
                    <FormControl><Input type="number" min={1} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="maxFileSizeMB" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max. Dateigröße (MB)</FormLabel>
                    <FormControl><Input type="number" min={1} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="retentionDays" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aufbewahrung (Tage)</FormLabel>
                    <FormControl><Input type="number" min={1} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Features */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Features</p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { name: "hasOutlookAddin", label: "Outlook-Add-in" },
                      { name: "hasBayernID", label: "BayernID-Anbindung" },
                      { name: "hasEID", label: "eID-Anbindung" },
                      { name: "hasAPI", label: "API-Zugang" },
                      { name: "isTrial", label: "Trial-Plan" },
                      { name: "active", label: "Aktiv (buchbar)" },
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
                              checked={field.value ?? false}
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
              </div>

              {isTrial && (
                <FormField control={form.control} name="trialDays" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trial-Dauer (Tage)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? null : parseInt(e.target.value))}
                        className="max-w-xs"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              {serverError && (
                <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{serverError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {props.mode === "create" ? "Anlegen" : "Speichern"}
                </button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
