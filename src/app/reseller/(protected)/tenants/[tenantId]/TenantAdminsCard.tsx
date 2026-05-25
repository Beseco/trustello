"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, CheckCircle } from "lucide-react";
import { resellerResetAdminPassword } from "@/server/actions/reseller-tenants";

type Admin = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  lastLoginAt: Date | null;
};

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

  if (admins.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Admins gefunden.</p>;
  }

  return (
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
            {errors[admin.id] && <p className="text-xs text-destructive">{errors[admin.id]}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
