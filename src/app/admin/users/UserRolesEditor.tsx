"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { updateUserRoles } from "@/server/actions/admin-users";
import type { UserRole } from "@prisma/client";

const ALL_ROLES: UserRole[] = ["TENANT_ADMIN", "USER_MANAGER", "CUSTOMER_MANAGER", "EMPLOYEE"];

const ROLE_LABELS: Record<UserRole, string> = {
  TENANT_ADMIN: "Mandant-Admin",
  USER_MANAGER: "Nutzerverwaltung",
  CUSTOMER_MANAGER: "Kundenverwaltung",
  EMPLOYEE: "Mitarbeiter",
};

const ROLE_VARIANTS: Record<UserRole, "default" | "secondary" | "outline"> = {
  TENANT_ADMIN: "default",
  USER_MANAGER: "secondary",
  CUSTOMER_MANAGER: "secondary",
  EMPLOYEE: "outline",
};

type Props = {
  userId: string;
  initialRoles: UserRole[];
  isSelf: boolean;
};

export function UserRolesEditor({ userId, initialRoles, isSelf }: Props) {
  const [open, setOpen] = useState(false);
  const [roles, setRoles] = useState<UserRole[]>(initialRoles);
  const [pending, startTransition] = useTransition();

  function toggle(role: UserRole) {
    const next = roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role];
    setRoles(next);
    startTransition(async () => {
      await updateUserRoles(userId, next);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => { if (!isSelf) setOpen(true); }}
        disabled={isSelf}
        title={isSelf ? "Eigene Rollen können nicht geändert werden" : "Rollen bearbeiten"}
        className="flex flex-wrap gap-1 text-left disabled:cursor-not-allowed"
      >
        {roles.map((role) => (
          <Badge key={role} variant={ROLE_VARIANTS[role]} className="text-xs">
            {ROLE_LABELS[role]}
          </Badge>
        ))}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {ALL_ROLES.map((role) => {
        const checked = roles.includes(role);
        return (
          <label key={role} className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={checked}
              disabled={pending}
              onChange={() => toggle(role)}
              className="h-3.5 w-3.5 rounded border-input accent-primary"
            />
            <Badge variant={ROLE_VARIANTS[role]} className="text-xs pointer-events-none">
              {ROLE_LABELS[role]}
            </Badge>
          </label>
        );
      })}
      <button
        onClick={() => setOpen(false)}
        className="mt-1 text-xs text-muted-foreground hover:text-foreground text-left"
      >
        Fertig
      </button>
    </div>
  );
}
