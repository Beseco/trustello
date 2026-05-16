"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { inviteUser } from "@/server/actions/admin-users";
import { assignUserToOU } from "@/server/actions/admin-users";
import type { UserRole } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { UserPlus, Loader2 } from "lucide-react";

const schema = z.object({
  firstName: z.string().min(1, "Erforderlich"),
  lastName: z.string().min(1, "Erforderlich"),
  email: z.string().email("Ungültige E-Mail"),
  roles: z.array(z.string()),
  ouId: z.string().optional(),
  ouRole: z.enum(["MEMBER", "ADMIN"]).optional(),
});
type FormData = z.infer<typeof schema>;

const ALL_ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: "TENANT_ADMIN", label: "Mandant-Administrator", description: "Vollzugriff" },
  { value: "USER_MANAGER", label: "Nutzerverwaltung", description: "Benutzer verwalten" },
  { value: "CUSTOMER_MANAGER", label: "Kundenverwaltung", description: "Bürger verwalten" },
  { value: "EMPLOYEE", label: "Mitarbeiter", description: "Nachrichten senden" },
];

type OUOption = { id: string; name: string };

type Props = { ous?: OUOption[] };

export function InviteUserDialog({ ous = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: "", lastName: "", email: "", roles: ["EMPLOYEE"], ouId: "", ouRole: "MEMBER" },
  });

  async function onSubmit(data: FormData) {
    setServerError(null);
    const result = await inviteUser({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      roles: data.roles as UserRole[],
      ouId: data.ouId || undefined,
      ouRole: data.ouRole,
    });
    if (result.error) {
      setServerError(result.error);
      return;
    }
    setSuccess(true);
    setTimeout(() => {
      setOpen(false);
      setSuccess(false);
      form.reset();
    }, 1500);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <UserPlus className="h-4 w-4" />
            Benutzer einladen
          </button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neuen Benutzer einladen</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center">
            <p className="text-sm font-medium text-green-600">Einladung versendet ✓</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Der Benutzer erhält eine E-Mail mit seinen Zugangsdaten.
            </p>
          </div>
        ) : (
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
                        <Input placeholder="Max" {...field} />
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
                        <Input placeholder="Mustermann" {...field} />
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
                    <FormLabel>E-Mail-Adresse</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="max@behoerde.de" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="roles"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rollen</FormLabel>
                    <div className="space-y-2">
                      {ALL_ROLES.map((role) => (
                        <label
                          key={role.value}
                          className="flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 hover:bg-muted/40"
                        >
                          <Checkbox
                            checked={field.value.includes(role.value)}
                            onCheckedChange={(checked: boolean) => {
                              if (checked) {
                                field.onChange([...field.value, role.value]);
                              } else {
                                field.onChange(field.value.filter((r) => r !== role.value));
                              }
                            }}
                            className="mt-0.5"
                          />
                          <div>
                            <p className="text-sm font-medium leading-none">{role.label}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{role.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </FormItem>
                )}
              />

              {ous.length > 0 && (
                <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Organisationseinheit (optional)
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name="ouId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Einheit</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? ""}>
                            <FormControl>
                              <SelectTrigger className="text-sm">
                                <SelectValue placeholder="Keine" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">Keine</SelectItem>
                              {ous.map((ou) => (
                                <SelectItem key={ou.id} value={ou.id}>
                                  {ou.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ouRole"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Rolle in Einheit</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? "MEMBER"}>
                            <FormControl>
                              <SelectTrigger className="text-sm">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="MEMBER">Mitglied</SelectItem>
                              <SelectItem value="ADMIN">OU-Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {serverError && (
                <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {serverError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Einladen
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
