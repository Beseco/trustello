import { notFound } from "next/navigation";
import { requireReseller } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TenantStatusSelect } from "../TenantStatusSelect";
import { PlanSelect } from "./PlanSelect";
import Link from "next/link";
import { ArrowLeft, Users, MessageSquare, HardDrive, Building2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import type { TenantStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<TenantStatus, string> = {
  TRIAL: "Trial", ACTIVE: "Aktiv", SUSPENDED: "Gesperrt", CANCELLED: "Gekündigt",
};
const STATUS_VARIANTS: Record<TenantStatus, "default" | "secondary" | "outline" | "destructive"> = {
  TRIAL: "secondary", ACTIVE: "default", SUSPENDED: "destructive", CANCELLED: "outline",
};

type PageProps = { params: Promise<{ tenantId: string }> };

export default async function TenantDetailPage({ params }: PageProps) {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;
  const { tenantId } = await params;

  const [tenant, plans, stats] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true, settings: true },
    }),
    prisma.plan.findMany({
      where: { resellerId },
      orderBy: { monthlyPrice: "asc" },
      select: { id: true, name: true, monthlyPrice: true },
    }),
    Promise.all([
      prisma.user.count({ where: { tenantId } }),
      prisma.message.count({ where: { tenantId, deletedAt: null } }),
      prisma.organisationUnit.count({ where: { tenantId } }),
      prisma.customer.count({ where: { tenantId } }),
    ]),
  ]);

  if (!tenant || tenant.resellerId !== resellerId) notFound();

  const [userCount, messageCount, ouCount, customerCount] = stats;
  const storageGB = Number(tenant.storageUsedBytes) / 1024 ** 3;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/reseller/tenants"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Zur Übersicht
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{tenant.name}</h1>
          <p className="mt-0.5 font-mono text-sm text-muted-foreground">{tenant.slug}</p>
        </div>
        <Badge variant={STATUS_VARIANTS[tenant.status]}>{STATUS_LABELS[tenant.status]}</Badge>
      </div>

      {/* Statistiken */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Benutzer", value: `${userCount} / ${tenant.plan.maxUsers}`, icon: <Users className="h-4 w-4" /> },
          { label: "Kunden", value: String(customerCount), icon: <Users className="h-4 w-4" /> },
          { label: "Nachrichten", value: String(messageCount), icon: <MessageSquare className="h-4 w-4" /> },
          { label: "Speicher", value: `${storageGB.toFixed(2)} / ${tenant.plan.storageGB} GB`, icon: <HardDrive className="h-4 w-4" /> },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <span className="text-muted-foreground">{s.icon}</span>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Plan & Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan & Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Aktueller Plan</span>
              <PlanSelect
                tenantId={tenant.id}
                currentPlanId={tenant.planId}
                plans={plans.map((p) => ({ id: p.id, name: p.name, monthlyPrice: String(p.monthlyPrice) }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <TenantStatusSelect tenantId={tenant.id} currentStatus={tenant.status} />
            </div>
            {tenant.trialEndsAt && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Trial läuft ab</span>
                <span className={tenant.trialEndsAt < new Date() ? "text-destructive" : ""}>
                  {format(tenant.trialEndsAt, "dd.MM.yyyy", { locale: de })}
                  {" "}({formatDistanceToNow(tenant.trialEndsAt, { addSuffix: true, locale: de })})
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              { label: "Abrechnung", value: tenant.billingEmail },
              { label: "Aufbewahrung", value: `${tenant.plan.retentionDays} Tage` },
              { label: "Max. Dateigröße", value: `${tenant.plan.maxFileSizeMB} MB` },
              { label: "OUs", value: String(ouCount) },
              {
                label: "Auto-Login-Domains",
                value: tenant.autoLoginDomains.length > 0 ? tenant.autoLoginDomains.join(", ") : "—",
              },
              {
                label: "Angelegt",
                value: format(tenant.createdAt, "dd.MM.yyyy", { locale: de }),
              },
            ].map((row) => (
              <div key={row.label} className="flex justify-between gap-4">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium text-right">{row.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
