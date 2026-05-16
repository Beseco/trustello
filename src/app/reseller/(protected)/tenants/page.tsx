import Link from "next/link";
import { requireReseller } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateTenantDialog } from "./CreateTenantDialog";
import { TenantStatusSelect } from "./TenantStatusSelect";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import type { TenantStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<TenantStatus, string> = {
  TRIAL: "Trial",
  ACTIVE: "Aktiv",
  SUSPENDED: "Gesperrt",
  CANCELLED: "Gekündigt",
};
const STATUS_VARIANTS: Record<TenantStatus, "default" | "secondary" | "outline" | "destructive"> =
  {
    TRIAL: "secondary",
    ACTIVE: "default",
    SUSPENDED: "destructive",
    CANCELLED: "outline",
  };

export default async function ResellerTenantsPage() {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const [tenants, plans] = await Promise.all([
    prisma.tenant.findMany({
      where: { resellerId },
      include: {
        plan: { select: { name: true, monthlyPrice: true } },
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.plan.findMany({
      where: { resellerId },
      orderBy: { monthlyPrice: "asc" },
      select: { id: true, name: true, monthlyPrice: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mandanten</h1>
          <p className="text-sm text-muted-foreground">{tenants.length} Mandanten</p>
        </div>
        <CreateTenantDialog
          plans={plans.map((p) => ({
            id: p.id,
            name: p.name,
            monthlyPrice: String(p.monthlyPrice),
          }))}
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Benutzer</TableHead>
              <TableHead>Angelegt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell className="font-medium">
                  <Link href={`/reseller/tenants/${tenant.id}`} className="hover:underline">
                    {tenant.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {tenant.slug}
                </TableCell>
                <TableCell>
                  {tenant.plan.name}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {Number(tenant.plan.monthlyPrice) === 0
                      ? ""
                      : `${tenant.plan.monthlyPrice} €/Mo`}
                  </span>
                </TableCell>
                <TableCell>
                  <TenantStatusSelect tenantId={tenant.id} currentStatus={tenant.status} />
                </TableCell>
                <TableCell>{tenant._count.users}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(tenant.createdAt, { addSuffix: true, locale: de })}
                </TableCell>
              </TableRow>
            ))}
            {tenants.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Noch keine Mandanten angelegt
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
