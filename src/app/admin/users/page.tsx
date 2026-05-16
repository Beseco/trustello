import { requireTenantAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { InviteUserDialog } from "./InviteUserDialog";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import type { UserRole } from "@prisma/client";
import Link from "next/link";
import { Users, Building2, Clock, Mail, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ROLE_META: Record<UserRole, { label: string; cls: string }> = {
  TENANT_ADMIN: { label: "Admin", cls: "bg-blue-100 text-blue-800 border-blue-200" },
  USER_MANAGER: { label: "Nutzer", cls: "bg-violet-100 text-violet-800 border-violet-200" },
  CUSTOMER_MANAGER: { label: "Kunden", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  EMPLOYEE: { label: "Mitarbeiter", cls: "bg-slate-100 text-slate-700 border-slate-200" },
};

const ONE_DAY_MS = 86400000;

export default async function AdminUsersPage() {
  const session = await requireTenantAdmin();
  const tenantId = session.user.tenantId!;
  const currentUserId = session.user.id!;

  const users = await prisma.user.findMany({
    where: { tenantId },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      position: true,
      roles: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      ous: {
        select: { role: true, ou: { select: { id: true, name: true } } },
        orderBy: { ou: { name: "asc" } },
      },
    },
  });

  const ous = await prisma.organisationUnit.findMany({
    where: { tenantId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const activeCount = users.filter((u) => u.isActive).length;
  const adminCount = users.filter((u) => u.roles.includes("TENANT_ADMIN")).length;
  // eslint-disable-next-line react-hooks/purity
  const oneDayAgo = new Date(Date.now() - ONE_DAY_MS);
  const todayLoginCount = users.filter((u) => u.lastLoginAt && u.lastLoginAt > oneDayAgo).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Benutzerverwaltung</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {activeCount} aktiv · {adminCount} Administrator{adminCount !== 1 ? "en" : ""}
          </p>
        </div>
        <InviteUserDialog ous={ous} />
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<Users className="h-4 w-4" />} label="Gesamt" value={users.length} />
        <StatCard icon={<Building2 className="h-4 w-4" />} label="Aktiv" value={activeCount} />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Heute eingeloggt"
          value={todayLoginCount}
        />
      </div>

      {/* User table */}
      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Name
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Rollen
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Einheiten
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Letzter Login
              </th>
              <th className="w-8 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              return (
                <tr
                  key={user.id}
                  style={{ borderBottom: "1px solid #f1f5f9" }}
                  className={cn(
                    "group transition-colors hover:bg-slate-50 last:border-0",
                    !user.isActive && "opacity-60",
                  )}
                >
                  {/* Name + contact */}
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${user.id}`} className="block">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[13.5px]">
                          {user.firstName} {user.lastName}
                        </span>
                        {isSelf && (
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            Sie
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted-foreground">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{user.email}</span>
                        {user.position && (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="truncate">{user.position}</span>
                          </>
                        )}
                      </div>
                    </Link>
                  </td>

                  {/* Roles */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => {
                        const meta = ROLE_META[role];
                        return (
                          <span
                            key={role}
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                              meta.cls,
                            )}
                          >
                            {meta.label}
                          </span>
                        );
                      })}
                      {user.roles.length === 0 && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>

                  {/* OUs */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.ous.map((uou) => (
                        <span
                          key={uou.ou.id}
                          className="inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600"
                        >
                          <Building2 className="h-2.5 w-2.5 text-slate-400" />
                          {uou.ou.name}
                          {uou.role === "ADMIN" && (
                            <span className="ml-0.5 text-violet-600">★</span>
                          )}
                        </span>
                      ))}
                      {user.ous.length === 0 && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <Badge
                      variant={user.isActive ? "default" : "outline"}
                      className="text-[11px]"
                    >
                      {user.isActive ? "Aktiv" : "Deaktiviert"}
                    </Badge>
                  </td>

                  {/* Last login */}
                  <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
                    {user.lastLoginAt
                      ? formatDistanceToNow(user.lastLoginAt, { addSuffix: true, locale: de })
                      : "Noch nie"}
                  </td>

                  {/* Arrow */}
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${user.id}`}>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  Keine Benutzer vorhanden
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold leading-none">{value}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
