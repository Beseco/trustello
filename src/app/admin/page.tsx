import { requireTenantAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, HardDrive, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireTenantAdmin();
  const tenantId = session.user.tenantId!;

  const [tenant, userCount, ouCount] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      include: { plan: true, settings: true },
    }),
    prisma.user.count({ where: { tenantId } }),
    prisma.organisationUnit.count({ where: { tenantId } }),
  ]);

  const storageGB = Number(tenant.storageUsedBytes) / 1024 ** 3;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{tenant.name}</h1>
          <Badge variant={tenant.status === "ACTIVE" ? "default" : "secondary"}>
            {tenant.status}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Plan: <span className="font-medium">{tenant.plan.name}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Benutzer"
          value={`${userCount} / ${tenant.plan.maxUsers}`}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          title="Organisations­einheiten"
          value={String(ouCount)}
          icon={<Building2 className="h-4 w-4" />}
        />
        <StatCard
          title="Speicher"
          value={`${storageGB.toFixed(2)} / ${tenant.plan.storageGB} GB`}
          icon={<HardDrive className="h-4 w-4" />}
        />
        <StatCard
          title="Sicherheitsstufe"
          value={tenant.settings?.defaultSecurityLevel ?? "LEVEL_2"}
          icon={<ShieldCheck className="h-4 w-4" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mandanten-Einstellungen</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <InfoRow label="Slug" value={tenant.slug} />
          <InfoRow label="Abrechnung" value={tenant.billingEmail} />
          <InfoRow
            label="Auto-Login-Domains"
            value={tenant.autoLoginDomains.length > 0 ? tenant.autoLoginDomains.join(", ") : "—"}
          />
          <InfoRow
            label="Aufbewahrungsfrist"
            value={
              tenant.settings?.retentionDaysOverride
                ? `${tenant.settings.retentionDaysOverride} Tage`
                : `${tenant.plan.retentionDays} Tage (Plan)`
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
