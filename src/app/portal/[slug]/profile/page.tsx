import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { LegalFooter } from "@/app/m/[messageId]/LegalFooter";
import { PortalHeader } from "../_components/PortalHeader";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { TotpCard } from "./TotpCard";
import { Mail, User, Shield } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export default async function CitizenProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();

  if (!session?.user || session.user.userType !== "customer") {
    redirect(`/portal/${slug}/login`);
  }

  const customerId = session.user.id!;
  const tenantId = session.user.tenantId!;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId, slug },
    select: {
      name: true,
      status: true,
      settings: { select: { imprintHtml: true, privacyPolicyHtml: true } },
    },
  });

  if (!tenant || !["ACTIVE", "TRIAL"].includes(tenant.status)) notFound();

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      salutation: true,
      createdAt: true,
      totpEnabled: true,
      trustLevel: true,
    },
  });

  if (!customer) redirect(`/portal/${slug}/login`);

  const fullName = `${customer.firstName} ${customer.lastName}`;

  return (
    <div className="min-h-screen bg-muted/40">
      <PortalHeader
        tenantName={tenant.name}
        slug={slug}
        customerName={fullName}
        activePath="profile"
      />

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <h2 className="text-lg font-semibold">Mein Profil</h2>

        {/* Konto-Info */}
        <div className="rounded-xl border bg-background p-6">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Persönliche Daten</h3>
          </div>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Name</dt>
              <dd className="mt-0.5 text-sm font-medium">
                {customer.salutation ? `${customer.salutation} ` : ""}
                {fullName}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">E-Mail</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 text-sm">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                {customer.email}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Mitglied seit</dt>
              <dd className="mt-0.5 text-sm">
                {format(customer.createdAt, "dd. MMMM yyyy", { locale: de })}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Vertrauensniveau</dt>
              <dd className="mt-0.5 text-sm">
                {customer.trustLevel === "NONE"
                  ? "Nicht verifiziert"
                  : customer.trustLevel === "EMAIL"
                  ? "E-Mail bestätigt"
                  : customer.trustLevel === "SMS"
                  ? "SMS bestätigt"
                  : customer.trustLevel}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            Zur Änderung Ihrer persönlichen Daten wenden Sie sich bitte an die Behörde.
          </p>
        </div>

        {/* Passwort */}
        <div className="rounded-xl border bg-background p-6">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Passwort ändern</h3>
          </div>
          <ChangePasswordForm />
        </div>

        {/* 2FA */}
        <div className="rounded-xl border bg-background p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Zwei-Faktor-Authentifizierung (2FA)</h3>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                customer.totpEnabled
                  ? "bg-green-100 text-green-700"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {customer.totpEnabled ? "Aktiv" : "Inaktiv"}
            </span>
          </div>
          <TotpCard totpEnabled={customer.totpEnabled} />
        </div>
      </main>

      {(tenant.settings?.imprintHtml || tenant.settings?.privacyPolicyHtml) && (
        <footer className="py-6">
          <LegalFooter
            imprintHtml={tenant.settings?.imprintHtml}
            privacyPolicyHtml={tenant.settings?.privacyPolicyHtml}
          />
        </footer>
      )}
    </div>
  );
}
