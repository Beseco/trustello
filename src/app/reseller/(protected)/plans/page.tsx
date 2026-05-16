import { requireReseller } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { PlanFormDialog } from "./PlanFormDialog";

export const dynamic = "force-dynamic";

export default async function ResellerPlansPage() {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const plans = await prisma.plan.findMany({
    where: { resellerId },
    orderBy: { monthlyPrice: "asc" },
    include: { _count: { select: { tenants: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Plans</h1>
          <p className="text-sm text-muted-foreground">{plans.length} Plans</p>
        </div>
        <PlanFormDialog mode="create" />
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Preis / Mo</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Benutzer</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Speicher</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Aufbewahrung</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Features</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Mandanten</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  Noch keine Plans angelegt
                </td>
              </tr>
            )}
            {plans.map((plan) => (
              <tr key={plan.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">
                  {plan.name}
                  {plan.isTrial && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({plan.trialDays ?? "?"} Tage)
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {Number(plan.monthlyPrice) === 0 ? (
                    <span className="text-muted-foreground">kostenlos</span>
                  ) : (
                    `${Number(plan.monthlyPrice).toFixed(2)} €`
                  )}
                </td>
                <td className="px-4 py-3">{plan.maxUsers}</td>
                <td className="px-4 py-3">{plan.storageGB} GB</td>
                <td className="px-4 py-3">{plan.retentionDays} Tage</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {plan.hasAPI && <Badge variant="outline" className="text-xs">API</Badge>}
                    {plan.hasOutlookAddin && <Badge variant="outline" className="text-xs">Outlook</Badge>}
                    {plan.hasBayernID && <Badge variant="outline" className="text-xs">BayernID</Badge>}
                    {plan.hasEID && <Badge variant="outline" className="text-xs">eID</Badge>}
                    {!plan.hasAPI && !plan.hasOutlookAddin && !plan.hasBayernID && !plan.hasEID && (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{plan._count.tenants}</td>
                <td className="px-4 py-3">
                  <Badge variant={plan.active ? "default" : "outline"} className="text-xs">
                    {plan.active ? "Aktiv" : "Inaktiv"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <PlanFormDialog
                    mode="edit"
                    planId={plan.id}
                    defaultValues={{
                      name: plan.name,
                      monthlyPrice: Number(plan.monthlyPrice),
                      setupFee: Number(plan.setupFee),
                      maxUsers: plan.maxUsers,
                      storageGB: plan.storageGB,
                      maxFileSizeMB: plan.maxFileSizeMB,
                      retentionDays: plan.retentionDays,
                      hasOutlookAddin: plan.hasOutlookAddin,
                      hasBayernID: plan.hasBayernID,
                      hasEID: plan.hasEID,
                      hasAPI: plan.hasAPI,
                      isTrial: plan.isTrial,
                      trialDays: plan.trialDays,
                      active: plan.active,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
