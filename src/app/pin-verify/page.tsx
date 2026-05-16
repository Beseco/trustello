/**
 * QR-Code-Verifizierungsseite
 * Aufgerufen durch QR-Code-Scan im PIN-Brief.
 * Verifiziert automatisch ohne manuelle PIN-Eingabe.
 */

import { verifyPinByQrToken } from "@/server/actions/pin-letter";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function PinVerifyPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <ErrorState
        title="Ungültiger Link"
        description="Dieser QR-Code ist ungültig. Bitte scannen Sie den QR-Code aus Ihrem PIN-Brief erneut."
      />
    );
  }

  const result = await verifyPinByQrToken(token);

  if (!result.ok) {
    return <ErrorState title="Verifizierung fehlgeschlagen" description={result.error} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm text-center space-y-6">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-slate-900">Konto erfolgreich verifiziert</h1>
          <p className="text-sm text-slate-500">
            Ihre Identität wurde per postalischem Zugangscode bestätigt.
            Sie können jetzt sicher auf Ihre Nachrichten zugreifen.
          </p>
        </div>

        <div className="rounded-lg bg-green-50 border border-green-200 p-3">
          <p className="text-xs text-green-700 font-medium">
            ✓ Vertrauensstufe: PIN-Brief
          </p>
        </div>

        {result.tenantSlug ? (
          <Link
            href={`/portal/${result.tenantSlug}`}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Zum Portal
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <p className="text-xs text-slate-400">
            Sie können dieses Fenster jetzt schließen.
          </p>
        )}
      </div>
    </div>
  );
}

function ErrorState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm text-center space-y-6">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{description}</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-slate-400">
            Alternativ können Sie Ihren Zugangscode manuell eingeben:
          </p>
          <Link
            href="/pin-verify/manual"
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Code manuell eingeben
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
