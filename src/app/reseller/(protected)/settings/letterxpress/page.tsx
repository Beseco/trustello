import { requireReseller } from "@/lib/auth-helpers";
import { getResellerLetterxpressConfig } from "@/server/actions/letterxpress-settings";
import { LetterxpressForm } from "./LetterxpressForm";
import { LetterxpressStatus } from "./LetterxpressStatus";
import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ResellerLetterxpressPage() {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const config = await getResellerLetterxpressConfig();

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
        <h1 className="text-xl font-semibold">PIN-Brief-Versand (LetterXpress)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Wird für die postalische Konto-Verifizierung über physische PIN-Briefe verwendet.
        </p>
      </div>

      {/* Verbindungsstatus */}
      <LetterxpressStatus resellerId={resellerId} />

      {/* Info-Box */}
      <div className="rounded-lg border bg-muted/40 p-4">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              Erstellen Sie einen API-Zugang in Ihrem LetterXpress-Konto unter{" "}
              <span className="font-mono text-xs">letterxpress.de → Mein Konto → API-Zugang</span>.
            </p>
            <p>
              Pro versendeten Brief fallen ca. 1,50 € (Schwarzweiß, DIN-Lang) an.
              Briefe werden i.d.R. innerhalb von 1–3 Werktagen zugestellt.
            </p>
          </div>
        </div>
      </div>

      {/* Konfigurationsformular */}
      <div className="rounded-xl border bg-background p-6">
        <h2 className="mb-4 text-base font-semibold">Zugangsdaten</h2>
        <LetterxpressForm initial={config} />
      </div>
    </div>
  );
}
