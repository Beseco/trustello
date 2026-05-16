import { requireCitizenAccount } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { User, Shield, Lock, CheckCircle2 } from "lucide-react";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { TotpCard } from "./TotpCard";
import { VaultSetupCard } from "./VaultSetupCard";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ welcome?: string }> };

export default async function ProfilPage({ searchParams }: Props) {
  const { citizenAccountId } = await requireCitizenAccount();
  const { welcome } = await searchParams;

  const ca = await prisma.citizenAccount.findUnique({
    where: { id: citizenAccountId },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      totpEnabled: true,
      vaultEnabled: true,
      createdAt: true,
    },
  });

  if (!ca) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Mein Profil</h1>

      {welcome === "1" && (
        <div className="flex items-center gap-3 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Konto erfolgreich eingerichtet!</p>
            <p className="text-green-600">
              Richten Sie jetzt Ihr Tresor-Passwort ein, damit Ihre Nachrichten Ende-zu-Ende verschlüsselt sind.
            </p>
          </div>
        </div>
      )}

      {/* Persönliche Daten */}
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800">
          <User className="h-4 w-4" />
          Persönliche Daten
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-slate-400">Name</dt>
            <dd className="text-sm text-slate-800">{ca.firstName} {ca.lastName}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-400">E-Mail</dt>
            <dd className="text-sm text-slate-800">{ca.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-400">Konto erstellt</dt>
            <dd className="text-sm text-slate-800">
              {format(ca.createdAt, "dd. MMMM yyyy", { locale: de })}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-400">Sicherheitsstatus</dt>
            <dd className="flex items-center gap-1.5 text-sm">
              {ca.vaultEnabled ? (
                <span className="flex items-center gap-1 text-blue-700">
                  <Shield className="h-3.5 w-3.5" />
                  Tresor aktiv (E2E)
                </span>
              ) : ca.totpEnabled ? (
                <span className="flex items-center gap-1 text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  2FA aktiv
                </span>
              ) : (
                <span className="text-slate-400">Standard</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {/* Tresor-Verschlüsselung */}
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-800">
          <Shield className="h-4 w-4 text-blue-600" />
          Tresor-Passwort (Ende-zu-Ende-Verschlüsselung)
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Mit einem Tresor-Passwort werden Ihre zukünftigen Nachrichten Ende-zu-Ende verschlüsselt —
          ähnlich wie bei FTAPI. Nur Sie können dann mit Ihrem Passwort die Nachrichten entschlüsseln.
        </p>
        <VaultSetupCard vaultEnabled={ca.vaultEnabled} />
      </section>

      {/* Passwort ändern */}
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800">
          <Lock className="h-4 w-4" />
          Passwort ändern
        </h2>
        <ChangePasswordForm />
      </section>

      {/* 2FA */}
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800">
          <Shield className="h-4 w-4" />
          Zwei-Faktor-Authentifizierung
        </h2>
        <TotpCard totpEnabled={ca.totpEnabled} />
      </section>
    </div>
  );
}
