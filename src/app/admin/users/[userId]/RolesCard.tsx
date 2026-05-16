"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateUserRoles } from "@/server/actions/admin-users";
import type { UserRole } from "@prisma/client";

type RoleDef = {
  value: UserRole;
  label: string;
  description: string;
  color: string;
};

const ROLES: RoleDef[] = [
  {
    value: "TENANT_ADMIN",
    label: "Mandant-Administrator",
    description:
      "Vollzugriff auf alle Einstellungen, Benutzer, Kunden und Nachrichten des Mandanten.",
    color: "bg-blue-100 text-blue-800 border-blue-200",
  },
  {
    value: "USER_MANAGER",
    label: "Nutzerverwaltung",
    description: "Darf Mitarbeiter einladen, Rollen vergeben und Konten deaktivieren.",
    color: "bg-violet-100 text-violet-800 border-violet-200",
  },
  {
    value: "CUSTOMER_MANAGER",
    label: "Kundenverwaltung",
    description: "Darf Bürger-Datensätze anlegen, bearbeiten und Vertrauensniveaus setzen.",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  {
    value: "EMPLOYEE",
    label: "Mitarbeiter",
    description: "Basisrolle: kann Nachrichten verfassen und den eigenen Postausgang einsehen.",
    color: "bg-slate-100 text-slate-700 border-slate-200",
  },
];

type Props = {
  userId: string;
  initialRoles: UserRole[];
  isSelf: boolean;
};

export function RolesCard({ userId, initialRoles, isSelf }: Props) {
  const [roles, setRoles] = useState<UserRole[]>(initialRoles);
  const [pending, startTransition] = useTransition();

  function toggle(role: UserRole) {
    if (isSelf) return;
    const next = roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role];
    setRoles(next);
    startTransition(async () => {
      const result = await updateUserRoles(userId, next);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3">
      {isSelf && (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Eigene Rollen können nicht verändert werden.
        </p>
      )}
      {ROLES.map((role) => {
        const active = roles.includes(role.value);
        return (
          <label
            key={role.value}
            className={[
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
              active ? "border-primary/30 bg-primary/5" : "border-border hover:bg-muted/40",
              isSelf ? "cursor-not-allowed opacity-70" : "",
              pending ? "pointer-events-none opacity-60" : "",
            ].join(" ")}
          >
            <input
              type="checkbox"
              checked={active}
              disabled={isSelf || pending}
              onChange={() => toggle(role.value)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={[
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                    role.color,
                  ].join(" ")}
                >
                  {role.label}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{role.description}</p>
            </div>
          </label>
        );
      })}
    </div>
  );
}
