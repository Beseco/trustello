import { requireReseller } from "@/lib/auth-helpers";
import { getResellerSmtpConfig, saveResellerSmtpConfig, testResellerSmtpConfig } from "@/server/actions/smtp-settings";
import { SmtpForm } from "@/components/smtp/SmtpForm";
import { prisma } from "@/lib/db";
import { ArrowLeft, Mail, Users } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ResellerSmtpPage() {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const [config, tenantCount] = await Promise.all([
    getResellerSmtpConfig(),
    prisma.tenant.count({
      where: {
        resellerId,
        smtpConfig: null, // Tenants ohne eigene SMTP-Config
        status: { in: ["ACTIVE", "TRIAL"] },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/reseller/settings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zu Einstellungen
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold">Zentraler E-Mail-Versand (SMTP)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dieser SMTP-Server wird für alle Mandanten verwendet, die keinen eigenen Server konfiguriert haben.
        </p>
      </div>

      {/* Reichweite */}
      <div className="rounded-lg border bg-muted/40 p-4">
        <div className="flex items-center gap-3">
          <Users className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm">
            <span className="font-medium">{tenantCount} aktive Mandanten</span>
            <span className="text-muted-foreground"> nutzen aktuell diese zentrale SMTP-Konfiguration.</span>
          </div>
        </div>
        {!config && (
          <div className="mt-2 flex items-start gap-2 text-sm text-amber-700">
            <Mail className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Kein zentraler SMTP konfiguriert. Alle Mandanten ohne eigene Konfiguration nutzen den Systemstandard (Env-Variablen).</span>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-background p-6">
        <SmtpForm
          initial={config}
          onSave={saveResellerSmtpConfig}
          onTest={testResellerSmtpConfig}
          fallbackLabel="System-Standard"
        />
      </div>
    </div>
  );
}
