import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Mail, MailOpen } from "lucide-react";
import { LegalFooter } from "@/app/m/[messageId]/LegalFooter";
import { PortalHeader } from "../_components/PortalHeader";
import { formatDistanceToNow, format } from "date-fns";
import { de } from "date-fns/locale";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export default async function CitizenDashboardPage({ params }: PageProps) {
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
    select: { firstName: true, lastName: true, email: true },
  });

  const messages = await prisma.message.findMany({
    where: { tenantId, recipientId: customerId, deletedAt: null },
    orderBy: { sentAt: "desc" },
    take: 50,
    select: {
      id: true,
      subjectPlain: true,
      subjectIsEncrypted: true,
      securityLevel: true,
      sentAt: true,
      expiresAt: true,
      firstReadAt: true,
      sender: { select: { firstName: true, lastName: true } },
      _count: { select: { events: { where: { eventType: "REPLIED" } } } },
    },
  });

  const now = new Date();

  return (
    <div className="min-h-screen bg-muted/40">
      <PortalHeader
        tenantName={tenant.name}
        slug={slug}
        customerName={`${customer?.firstName} ${customer?.lastName}`}
        activePath="messages"
      />

      <main className="mx-auto max-w-3xl px-4 py-8">
        <h2 className="mb-4 text-lg font-semibold">Meine Nachrichten</h2>

        {messages.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-background p-12 text-center text-muted-foreground">
            <Mail className="mx-auto mb-3 h-8 w-8" />
            <p>Noch keine Nachrichten vorhanden.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => {
              const isExpired = msg.expiresAt < now;
              const subject = msg.subjectIsEncrypted ? "🔒 Verschlüsselt" : (msg.subjectPlain ?? "—");
              const senderName = `${msg.sender.firstName} ${msg.sender.lastName}`;
              const hasReplied = msg._count.events > 0;

              return (
                <Link
                  key={msg.id}
                  href={`/m/${msg.id}`}
                  className="flex items-start gap-3 rounded-lg border bg-background p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="mt-0.5 shrink-0 text-muted-foreground">
                    {msg.firstReadAt ? (
                      <MailOpen className="h-4 w-4" />
                    ) : (
                      <Mail className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium text-sm">{subject}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNow(msg.sentAt, { addSuffix: true, locale: de })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Von {senderName} · {format(msg.sentAt, "dd.MM.yyyy", { locale: de })}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {isExpired ? (
                        <Badge variant="destructive" className="text-xs">Abgelaufen</Badge>
                      ) : !msg.firstReadAt ? (
                        <Badge className="text-xs">Neu</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Gelesen</Badge>
                      )}
                      {hasReplied && (
                        <Badge variant="outline" className="text-xs">Beantwortet</Badge>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
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
