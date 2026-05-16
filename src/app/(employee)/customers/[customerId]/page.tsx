import { notFound } from "next/navigation";
import { requireEmployee } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import {
  ArrowLeft, Mail, MessageSquare, Phone, MapPin, ShieldCheck, PenSquare, StickyNote,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { de } from "date-fns/locale";
import type { TrustLevel } from "@prisma/client";
import { CustomerNotes } from "@/app/admin/customers/[customerId]/CustomerNotes";

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

type PageProps = { params: Promise<{ customerId: string }> };

export default async function EmployeeCustomerDetailPage({ params }: PageProps) {
  const session = await requireEmployee();
  const { tenantId } = await getTenantContext();
  const { customerId } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      receivedMessages: {
        where: { deletedAt: null },
        orderBy: { sentAt: "desc" },
        take: 20,
        select: {
          id: true,
          subjectIsEncrypted: true,
          subjectPlain: true,
          securityLevel: true,
          sentAt: true,
          firstReadAt: true,
          expiresAt: true,
          sender: { select: { firstName: true, lastName: true } },
          _count: { select: { events: { where: { eventType: "REPLIED" } } } },
        },
      },
      notes: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { firstName: true, lastName: true } } },
      },
    },
  });

  if (!customer || customer.tenantId !== tenantId) notFound();

  const notes = customer.notes.map((n) => ({
    id: n.id,
    content: n.content,
    createdAt: n.createdAt,
    author: n.author,
    isOwn: n.authorId === session.user.id,
  }));

  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/customers"
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
        <div className="flex items-center gap-2">
          <Badge variant={customer.trustLevel === "NONE" ? "outline" : "secondary"} className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            {TRUST_LABELS[customer.trustLevel]}
          </Badge>
          <Link
            href={`/compose?recipientId=${customer.id}`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <PenSquare className="h-4 w-4" />
            Nachricht schreiben
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Messages + Notes */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" />
                Nachrichtenverlauf
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {customer.receivedMessages.length} Nachrichten
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customer.receivedMessages.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Noch keine Nachrichten an diesen Kunden gesendet.
                </div>
              ) : (
                <ul className="divide-y">
                  {customer.receivedMessages.map((msg) => {
                    const isExpired = msg.expiresAt < now;
                    const subject = msg.subjectIsEncrypted ? "🔒 Verschlüsselt" : (msg.subjectPlain ?? "—");
                    const senderName = `${msg.sender.firstName} ${msg.sender.lastName}`;
                    const hasReply = msg._count.events > 0;

                    return (
                      <li key={msg.id} className="flex items-start gap-3 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/inbox/${msg.id}`}
                              className="truncate font-medium text-sm hover:underline"
                            >
                              {subject}
                            </Link>
                            {isExpired && (
                              <Badge variant="destructive" className="shrink-0 text-xs">Abgelaufen</Badge>
                            )}
                            {hasReply && (
                              <Badge variant="outline" className="shrink-0 text-xs">Beantwortet</Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Von {senderName} · {format(msg.sentAt, "dd.MM.yyyy HH:mm", { locale: de })}
                            {msg.firstReadAt ? " · Gelesen" : " · Ungelesen"}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDistanceToNow(msg.sentAt, { addSuffix: true, locale: de })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
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

        {/* Right: Contact info */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" />
                Kontakt
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <a href={`mailto:${customer.email}`} className="hover:underline break-all">
                  {customer.email}
                </a>
              </div>
              {customer.mobilePhone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <a href={`tel:${customer.mobilePhone}`} className="hover:underline">
                    {customer.mobilePhone}
                  </a>
                </div>
              )}
              {customer.street && (
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>
                    {customer.street}
                    <br />
                    {customer.zipCode} {customer.city}
                  </span>
                </div>
              )}
              <div className="border-t pt-3 text-xs text-muted-foreground">
                Angelegt: {format(customer.createdAt, "dd.MM.yyyy", { locale: de })}
              </div>
            </CardContent>
          </Card>

          {customer.hasAccount && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                  <ShieldCheck className="h-4 w-4" />
                  Bürger-Konto aktiv
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Dieser Kunde kann sich am Bürger-Portal einloggen.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
