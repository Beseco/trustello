"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { assignUserToOU, removeUserFromOU } from "@/server/actions/admin-users";
import { Users, X, Plus, Mail, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import type { UserRole } from "@prisma/client";

const ROLE_META: Record<UserRole, { label: string; cls: string }> = {
  TENANT_ADMIN: { label: "Admin", cls: "bg-blue-100 text-blue-800 border-blue-200" },
  USER_MANAGER: { label: "Nutzer", cls: "bg-violet-100 text-violet-800 border-violet-200" },
  CUSTOMER_MANAGER: { label: "Kunden", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  EMPLOYEE: { label: "Mitarbeiter", cls: "bg-slate-100 text-slate-700 border-slate-200" },
};

type Member = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string | null;
  isActive: boolean;
  roles: UserRole[];
  lastLoginAt: string | null;
  ouRole: "MEMBER" | "ADMIN";
};

type NonMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string | null;
};

type Props = {
  ouId: string;
  members: Member[];
  nonMembers: NonMember[];
};

export function OUMemberManager({ ouId, members: initial, nonMembers: initialNonMembers }: Props) {
  const [members, setMembers] = useState<Member[]>(initial);
  const [nonMembers, setNonMembers] = useState<NonMember[]>(initialNonMembers);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    if (!selectedUserId) return;
    const user = nonMembers.find((u) => u.id === selectedUserId);
    if (!user) return;
    startTransition(async () => {
      const result = await assignUserToOU(selectedUserId, ouId, selectedRole);
      if (result.error) {
        toast.error(result.error);
      } else {
        setMembers((prev) => [
          ...prev,
          {
            userId: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            position: user.position,
            isActive: true,
            roles: [],
            lastLoginAt: null,
            ouRole: selectedRole,
          },
        ]);
        setNonMembers((prev) => prev.filter((u) => u.id !== selectedUserId));
        setSelectedUserId("");
        setShowAdd(false);
        toast.success(`${user.firstName} ${user.lastName} hinzugefügt`);
      }
    });
  }

  function handleRemove(userId: string, name: string) {
    startTransition(async () => {
      const result = await removeUserFromOU(userId, ouId);
      if (result.error) {
        toast.error(result.error);
      } else {
        const removed = members.find((m) => m.userId === userId);
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
        if (removed) {
          setNonMembers((prev) =>
            [
              ...prev,
              {
                id: userId,
                firstName: removed.firstName,
                lastName: removed.lastName,
                email: removed.email,
                position: removed.position,
              },
            ].sort((a, b) => a.firstName.localeCompare(b.firstName)),
          );
        }
        toast.success(`${name} entfernt`);
      }
    });
  }

  function handleRoleChange(userId: string, newRole: "MEMBER" | "ADMIN") {
    startTransition(async () => {
      const result = await assignUserToOU(userId, ouId, newRole);
      if (result.error) {
        toast.error(result.error);
      } else {
        setMembers((prev) =>
          prev.map((m) => (m.userId === userId ? { ...m, ouRole: newRole } : m)),
        );
      }
    });
  }

  return (
    <div>
      {members.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
          <Users className="h-8 w-8 text-muted-foreground/40" />
          <p>Noch keine Mitarbeiter in dieser Einheit</p>
        </div>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
              <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mitarbeiter</th>
              <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Systemrollen</th>
              <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">OU-Rolle</th>
              <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Letzter Login</th>
              <th className="w-8 px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr
                key={m.userId}
                style={{ borderBottom: "1px solid #f1f5f9" }}
                className="last:border-0 hover:bg-slate-50 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${m.userId}`} className="block hover:underline">
                    <div className="font-medium text-[13.5px]">
                      {m.firstName} {m.lastName}
                      {!m.isActive && (
                        <span className="ml-1.5 text-[11px] text-muted-foreground">(inaktiv)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      {m.email}
                      {m.position && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          {m.position}
                        </>
                      )}
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {m.roles.map((role) => {
                      const meta = ROLE_META[role];
                      return (
                        <span
                          key={role}
                          className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${meta.cls}`}
                        >
                          {meta.label}
                        </span>
                      );
                    })}
                    {m.roles.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Select
                    value={m.ouRole}
                    onValueChange={(v) => handleRoleChange(m.userId, v as "MEMBER" | "ADMIN")}
                    disabled={pending}
                  >
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">Mitglied</SelectItem>
                      <SelectItem value="ADMIN">OU-Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
                  {m.lastLoginAt
                    ? formatDistanceToNow(new Date(m.lastLoginAt), { addSuffix: true, locale: de })
                    : "Noch nie"}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleRemove(m.userId, `${m.firstName} ${m.lastName}`)}
                    disabled={pending}
                    className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                    title="Aus Einheit entfernen"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add member */}
      <div className="border-t px-4 py-3">
        {showAdd ? (
          <div className="flex items-center gap-2">
            <Select
              value={selectedUserId}
              onValueChange={(v) => setSelectedUserId(v ?? "")}
              disabled={pending}
            >
              <SelectTrigger className="flex-1 text-sm">
                <SelectValue placeholder="Mitarbeiter auswählen…" />
              </SelectTrigger>
              <SelectContent>
                {nonMembers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                    {u.position && ` · ${u.position}`}
                  </SelectItem>
                ))}
                {nonMembers.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Alle Mitarbeiter bereits Mitglied
                  </div>
                )}
              </SelectContent>
            </Select>
            <Select
              value={selectedRole}
              onValueChange={(v) => setSelectedRole(v as "MEMBER" | "ADMIN")}
              disabled={pending}
            >
              <SelectTrigger className="w-32 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEMBER">Mitglied</SelectItem>
                <SelectItem value="ADMIN">OU-Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAdd} disabled={!selectedUserId || pending}>
              Hinzufügen
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
              Abbrechen
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
            Mitarbeiter hinzufügen
          </button>
        )}
      </div>
    </div>
  );
}
