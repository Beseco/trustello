"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Loader2, CheckCircle, UserPlus } from "lucide-react";
import { resellerResetAdminPassword, resellerCreateTenantAdmin } from "@/server/actions/reseller-tenants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Admin = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  lastLoginAt: Date | null;
};

function CreateAdminDialog({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await resellerCreateTenantAdmin(tenantId, { firstName, lastName, email });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    setTimeout(() => {
      setOpen(false);
      setSuccess(false);
      setFirstName("");
      setLastName("");
      setEmail("");
    }, 1500);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted">
            <UserPlus className="h-4 w-4" />
            Admin anlegen
          </button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Administrator anlegen</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center">
            <p className="text-sm font-medium text-green-600">Admin angelegt ✓</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Eine E-Mail mit den Zugangsdaten wurde versendet.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">Vorname</Label>
                <Input
                  id="firstName"
                  placeholder="Max"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Nachname</Label>
                <Input
                  id="lastName"
                  placeholder="Mustermann"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@behoerde.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Anlegen & einladen
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function TenantAdminsCard({ tenantId, admins }: { tenantId: string; admins: Admin[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleReset(userId: string) {
    setLoadingId(userId);
    setErrors((e) => ({ ...e, [userId]: "" }));
    const result = await resellerResetAdminPassword(tenantId, userId);
    setLoadingId(null);
    if (result.error) {
      setErrors((e) => ({ ...e, [userId]: result.error! }));
    } else {
      setSentId(userId);
      setTimeout(() => setSentId(null), 4000);
    }
  }

  return (
    <div className="space-y-4">
      {admins.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Admins gefunden.</p>
      ) : (
        <div className="space-y-3">
          {admins.map((admin) => (
            <div key={admin.id} className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {admin.firstName} {admin.lastName}
                </p>
                <p className="text-xs text-muted-foreground truncate">{admin.email}</p>
                <p className="text-xs text-muted-foreground">
                  {admin.lastLoginAt
                    ? `Letzter Login: ${new Date(admin.lastLoginAt).toLocaleDateString("de-DE")}`
                    : "Noch nie eingeloggt"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReset(admin.id)}
                  disabled={loadingId === admin.id || sentId === admin.id}
                  className="gap-1.5 shrink-0"
                >
                  {loadingId === admin.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : sentId === admin.id ? (
                    <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Mail className="h-3.5 w-3.5" />
                  )}
                  {sentId === admin.id ? "Gesendet ✓" : "Neues Passwort senden"}
                </Button>
                {errors[admin.id] && (
                  <p className="text-xs text-destructive">{errors[admin.id]}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="pt-1">
        <CreateAdminDialog tenantId={tenantId} />
      </div>
    </div>
  );
}
