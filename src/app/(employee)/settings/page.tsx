import { requireEmployee } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { TotpSetup } from "./TotpSetup";
import { ProfileForm } from "./ProfileForm";
import { resolveSignature } from "@/lib/signature";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireEmployee();
  const userId = session.user.id!;
  const tenantId = session.user.tenantId!;

  const [user, settings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        position: true,
        totpEnabled: true,
      },
    }),
    prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { signatureTemplate: true },
    }),
  ]);

  const signaturePreview =
    user && settings?.signatureTemplate
      ? resolveSignature(settings.signatureTemplate, user)
      : null;

  return (
    <div className="max-w-xl space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Mein Konto</h1>

      {/* Profil */}
      <section className="overflow-hidden rounded-lg border bg-white">
        <div
          className="px-5 py-3.5"
          style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}
        >
          <h2 className="text-[13.5px] font-semibold">Persönliche Daten</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Diese Angaben werden in der Signatur Ihrer Nachrichten verwendet.
          </p>
        </div>
        <div className="p-5">
          <ProfileForm
            defaultValues={{
              firstName: user?.firstName ?? "",
              lastName: user?.lastName ?? "",
              phone: user?.phone ?? "",
              position: user?.position ?? "",
            }}
            signaturePreview={signaturePreview}
          />
        </div>
      </section>

      {/* Passwort */}
      <section className="overflow-hidden rounded-lg border bg-white">
        <div
          className="px-5 py-3.5"
          style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}
        >
          <h2 className="text-[13.5px] font-semibold">Passwort ändern</h2>
        </div>
        <div className="p-5">
          <ChangePasswordForm />
        </div>
      </section>

      {/* TOTP */}
      <section className="overflow-hidden rounded-lg border bg-white">
        <div
          className="px-5 py-3.5"
          style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}
        >
          <h2 className="text-[13.5px] font-semibold">Zwei-Faktor-Authentifizierung</h2>
        </div>
        <div className="p-5">
          <TotpSetup totpEnabled={user?.totpEnabled ?? false} />
        </div>
      </section>
    </div>
  );
}
