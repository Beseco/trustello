import { requireTenantAdmin } from "@/lib/auth-helpers";
import { getTenantSmtpConfig, saveTenantSmtpConfig, deleteTenantSmtpConfig, testTenantSmtpConfig } from "@/server/actions/smtp-settings";
import { SmtpForm } from "@/components/smtp/SmtpForm";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TenantSmtpPage() {
  await requireTenantAdmin();
  const { tenantId } = await getTenantContext();

  const [config, tenant] = await Promise.all([
    getTenantSmtpConfig(),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        reseller: {
          select: {
            name: true,
            smtpConfig: { select: { host: true, fromEmail: true } },
          },
        },
      },
    }),
  ]);

  const resellerHasSmtp = !!tenant?.reseller?.smtpConfig;
  const fallbackLabel = resellerHasSmtp
    ? `${tenant?.reseller?.name ?? "Reseller"}-SMTP (${tenant?.reseller?.smtpConfig?.host})`
    : "System-Standard";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/admin/settings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zu Einstellungen
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold">E-Mail-Versand (SMTP)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Konfigurieren Sie einen eigenen SMTP-Server für ausgehende E-Mails Ihrer Organisation.
          Wenn kein eigener Server eingetragen ist, wird {resellerHasSmtp ? "der zentrale SMTP-Server Ihres Resellers" : "der System-Standard"} verwendet.
        </p>
      </div>

      {/* Info-Box: aktuell aktiver Fallback */}
      {!config && (
        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="text-sm">
              <p className="font-medium">Aktuell aktiv: {resellerHasSmtp ? "Reseller-SMTP" : "System-Standard"}</p>
              {resellerHasSmtp && (
                <p className="text-muted-foreground mt-0.5">
                  Server: <code className="text-xs">{tenant?.reseller?.smtpConfig?.host}</code>
                  {" · "}Absender: <code className="text-xs">{tenant?.reseller?.smtpConfig?.fromEmail}</code>
                </p>
              )}
              {!resellerHasSmtp && (
                <p className="text-muted-foreground mt-0.5">
                  Kein Reseller-SMTP konfiguriert. Systemweiter Standard wird verwendet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-background p-6">
        <SmtpForm
          initial={config}
          onSave={saveTenantSmtpConfig}
          onTest={testTenantSmtpConfig}
          onDelete={deleteTenantSmtpConfig}
          fallbackLabel={fallbackLabel}
        />
      </div>
    </div>
  );
}
