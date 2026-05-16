import { notFound } from "next/navigation";
import { requireEmployee } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditCustomerForm } from "./EditCustomerForm";
import { CustomerNotes } from "./CustomerNotes";
import { CustomerAccountCard } from "./CustomerAccountCard";
import { TrustLevelSelect } from "./TrustLevelSelect";
import { CustomerOUSelect } from "./CustomerOUSelect";
import Link from "next/link";
import { ArrowLeft, Mail, MessageSquare, ShieldCheck, StickyNote, KeyRound, Building2, Shield } from "lucide-react";
import { GdprCard } from "./GdprCard";
import { PinLetterButton } from "./PinLetterButton";
import type { PinLetterStatus } from "@/server/actions/pin-letter";
import { formatDistanceToNow, format } from "date-fns";
import { de } from "date-fns/locale";
import type { TrustLevel } from "@prisma/client";

export const dynamic = "force-dynamic";

const TRUST_LABELS: Record<TrustLevel, string> = {
  NONE: "Keine Verifizierung",
  EMAIL: "E-Mail verifiziert",
  SMS: "SMS verifiziert",
  PIN_LETTER: "PIN-Brief",
  BAYERN_ID_S: "BayernID (Substantiell)",
  BAYERN_ID_H: "BayernID (Hoch)",
  EID: "eID",
};

type PageProps = {
  params: Promise<{ customerId: string }>;
};

export default async function CustomerDetailPage({ params }: PageProps) {
  const session = await requireEmployee();
  const { tenantId } = await getTenantContext();
  const { customerId } = await params;

  const [customer, tenant, allOUs, pinLetterStatus] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        ous: { select: { ouId: true } },
        receivedMessages: {
          where: { deletedAt: null },
          orderBy: { sentAt: "desc" },
          take: 10,
          select: {
            id: true,
            subjectIsEncrypted: true,
            subjectPlain: true,
            securityLevel: true,
            sentAt: true,
            firstReadAt: true,
            sender: { select: { firstName: true, lastName: true } },
          },
        },
        notes: {
          orderBy: { createdAt: "desc" },
          include: { author: { select: { firstName: true, lastName: true } } },
        },
      },
    }),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } }),
    prisma.organisationUnit.findMany({
      where: { tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.pinLetterToken.findFirst({
      where: { customerId, tenantId, supersededAt: null },
      orderBy: { sentAt: "desc" },
      select: {
        id: true,
        sentAt: true,
        expiresAt: true,
        usedAt: true,
        supersededAt: true,
        letterxpressId: true,
        attempts: true,
      },
    }),
  ]);

  if (!customer || customer.tenantId !== tenantId) notFound();

  const notes = customer.notes.map((n) => ({
    id: n.id,
    content: n.content,
    createdAt: n.createdAt,
    author: n.author,
    isOwn: n.authorId === session.user.id,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/customers"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Zur Übersicht
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {customer.salutation ? `${customer.salutation} ` : ""}
            {customer.firstName} {customer.lastName}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{customer.email}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant={customer.trustLevel === "NONE" ? "outline" : "secondary"} className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            {TRUST_LABELS[customer.trustLevel]}
          </Badge>
          <TrustLevelSelect customerId={customer.id} current={customer.trustLevel} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Edit form + Notes */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stammdaten bearbeiten</CardTitle>
            </CardHeader>
            <CardContent>
              <EditCustomerForm
                customerId={customer.id}
                defaultValues={{
                  salutation: customer.salutation ?? "",
                  firstName: customer.firstName,
                  lastName: customer.lastName,
                  email: customer.email,
                  mobilePhone: customer.mobilePhone ?? "",
                  street: customer.street ?? "",
                  zipCode: customer.zipCode ?? "",
                  city: customer.city ?? "",
                  visibility: customer.visibility,
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <StickyNote className="h-4 w-4" />
                Interne Notizen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CustomerNotes customerId={customer.id} initialNotes={notes} />
            </CardContent>
          </Card>
        </div>

        {/* Right: Contact, Account, Messages */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" />
                Kontaktdaten
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {customer.mobilePhone && (
                <div>
                  <span className="text-muted-foreground">Mobil: </span>
                  {customer.mobilePhone}
                </div>
              )}
              {customer.street && (
                <div>
                  <span className="text-muted-foreground">Adresse: </span>
                  {customer.street}, {customer.zipCode} {customer.city}
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Angelegt: </span>
                {format(customer.createdAt, "dd.MM.yyyy", { locale: de })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4" />
                Bürger-Konto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CustomerAccountCard
                customerId={customer.id}
                hasAccount={customer.hasAccount}
                tenantSlug={tenant?.slug ?? ""}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" />
                Organisationseinheiten
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CustomerOUSelect
                customerId={customer.id}
                allOUs={allOUs}
                assignedOUIds={customer.ous.map((o) => o.ouId)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" />
                Letzte Nachrichten
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customer.receivedMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Nachrichten</p>
              ) : (
                <ul className="space-y-2">
                  {customer.receivedMessages.map((msg) => (
                    <li key={msg.id} className="text-sm">
                      <Link
                        href={`/inbox/${msg.id}`}
                        className="font-medium hover:underline"
                      >
                        {msg.subjectIsEncrypted ? "🔒 Verschlüsselt" : (msg.subjectPlain ?? "—")}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(msg.sentAt, { addSuffix: true, locale: de })}
                        {msg.firstReadAt ? " · Gelesen" : " · Ungelesen"}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" />
                DSGVO
              </CardTitle>
            </CardHeader>
            <CardContent>
              <GdprCard
                customerId={customer.id}
                customerName={`${customer.firstName} ${customer.lastName}`}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" />
                PIN-Brief-Verifizierung
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-muted-foreground">
                Sendet einen physischen Brief mit Zugangscode und QR-Code. Nach Verifizierung
                wird das Trust-Level auf &ldquo;PIN-Brief&rdquo; angehoben.
              </p>
              <PinLetterButton
                customerId={customer.id}
                hasAddress={!!(customer.street && customer.zipCode && customer.city)}
                status={pinLetterStatus}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
