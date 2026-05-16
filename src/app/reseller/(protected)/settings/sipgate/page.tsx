import { requireReseller } from "@/lib/auth-helpers";
import { getResellerSipgateConfig, getResellerSmsUsage } from "@/server/actions/sipgate-settings";
import { getCurrentMonth } from "@/lib/sms/phone";
import { SipgateForm } from "./SipgateForm";
import { SipgateStatus } from "./SipgateStatus";
import { SmsUsageTable } from "./SmsUsageTable";
import { ArrowLeft, MessageSquare } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ResellerSipgatePage() {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const currentMonth = getCurrentMonth();

  const [config, accountRows] = await Promise.all([
    getResellerSipgateConfig(),
    getResellerSmsUsage(currentMonth),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
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
        <h1 className="text-xl font-semibold">SMS-Versand (sipgate)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Wird für die automatische Passwort-Übermittlung bei Stufe-3- und Stufe-4-Nachrichten verwendet.
        </p>
      </div>

      {/* Verbindungsstatus */}
      <SipgateStatus resellerId={resellerId} />

      {/* Info-Box */}
      <div className="rounded-lg border bg-muted/40 p-4">
        <div className="flex items-start gap-3">
          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">
            <p>
              Erstellen Sie einen Personal Access Token in Ihrem sipgate-Konto unter{" "}
              <span className="font-mono text-xs">app.sipgate.com → Einstellungen → API</span>.
              Die SMS-ID (z.&nbsp;B. <span className="font-mono text-xs">s0</span>) finden Sie unter{" "}
              <span className="font-mono text-xs">Produkte → SMS</span>.
            </p>
          </div>
        </div>
      </div>

      {/* Konfigurationsformular */}
      <div className="rounded-xl border bg-background p-6">
        <SipgateForm initial={config} />
      </div>

      {/* SMS-Nutzungsübersicht */}
      <div className="rounded-xl border bg-background p-6">
        <SmsUsageTable rows={accountRows} currentMonth={currentMonth} />
      </div>
    </div>
  );
}
