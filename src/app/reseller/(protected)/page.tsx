import { requireReseller } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { Building2, Users, TrendingUp, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ResellerDashboard() {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const [tenants, totalUsers] = await Promise.all([
    prisma.tenant.findMany({
      where: { resellerId },
      include: { plan: { select: { name: true, monthlyPrice: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count({ where: { tenant: { resellerId } } }),
  ]);

  const activeTenants = tenants.filter((t) => t.status === "ACTIVE" || t.status === "TRIAL");
  const mrr = tenants
    .filter((t) => t.status === "ACTIVE")
    .reduce((sum, t) => sum + Number(t.plan.monthlyPrice), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reseller-Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Übersicht über alle Mandanten</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Mandanten gesamt"
          value={tenants.length}
          icon={<Building2 className="h-4 w-4" />}
        />
        <StatCard
          title="Aktive Mandanten"
          value={activeTenants.length}
          icon={<Building2 className="h-4 w-4 text-green-600" />}
        />
        <StatCard
          title="Benutzer gesamt"
          value={totalUsers}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          title="MRR (€)"
          value={`${mrr.toFixed(2)} €`}
          icon={<TrendingUp className="h-4 w-4 text-green-600" />}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Mandanten</h2>
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Plan</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Slug</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Erstellt</th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Keine Mandanten vorhanden
                  </td>
                </tr>
              )}
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{tenant.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{tenant.plan.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={tenant.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {tenant.slug}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {tenant.createdAt.toLocaleDateString("de-DE")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    ACTIVE: { label: "Aktiv", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    TRIAL: { label: "Trial", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    SUSPENDED: { label: "Gesperrt", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
    CANCELLED: { label: "Gekündigt", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  };
  const { label, className } = map[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
