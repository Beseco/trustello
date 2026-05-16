import { requireTenantAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { SettingsForm } from "./SettingsForm";
import { SignatureForm } from "./SignatureForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireTenantAdmin();
  const tenantId = session.user.tenantId!;

  const [settings, plan] = await Promise.all([
    prisma.tenantSettings.findUnique({ where: { tenantId } }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: { select: { retentionDays: true } } },
    }),
  ]);

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Einstellungen</h1>

      {/* Nachrichten-Standards */}
      <section className="overflow-hidden rounded-lg border bg-white">
        <div
          className="px-5 py-3.5"
          style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}
        >
          <h2 className="text-[13.5px] font-semibold">Nachrichten-Standardwerte</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Plan-Standard Aufbewahrungsfrist: {plan?.plan.retentionDays ?? "—"} Tage
          </p>
        </div>
        <div className="p-5">
          <SettingsForm
            defaultValues={{
              defaultSecurityLevel: settings?.defaultSecurityLevel ?? "LEVEL_2",
              defaultMinTrustLevel: settings?.defaultMinTrustLevel ?? "EMAIL",
              allowCustomerReplyDefault: settings?.allowCustomerReplyDefault ?? true,
              allowSubjectEncryption: settings?.allowSubjectEncryption ?? true,
              allowEmployeeOUCreate: settings?.allowEmployeeOUCreate ?? false,
              retentionDaysOverride: settings?.retentionDaysOverride ?? null,
            }}
          />
        </div>
      </section>

      {/* Zentrale Signatur */}
      <section className="overflow-hidden rounded-lg border bg-white">
        <div
          className="px-5 py-3.5"
          style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}
        >
          <h2 className="text-[13.5px] font-semibold">Zentrale E-Mail-Signatur</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Diese Vorlage wird automatisch an jede Nachricht angehängt. Platzhalter werden mit
            den persönlichen Daten des jeweiligen Mitarbeiters befüllt.
          </p>
        </div>
        <div className="p-5">
          <SignatureForm defaultTemplate={settings?.signatureTemplate ?? null} />
        </div>
      </section>
    </div>
  );
}
