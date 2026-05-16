import { requireTenantAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const EVENT_META: Record<string, { label: string; cls: string }> = {
  SENT: { label: "Gesendet", cls: "bg-blue-100 text-blue-800" },
  DELIVERED_NOTIFICATION: { label: "Benachrichtigt", cls: "bg-sky-100 text-sky-800" },
  OPENED: { label: "Geöffnet", cls: "bg-green-100 text-green-700" },
  ATTACHMENT_DOWNLOADED: { label: "Anhang geladen", cls: "bg-teal-100 text-teal-800" },
  REPLIED: { label: "Beantwortet", cls: "bg-violet-100 text-violet-800" },
  EXPIRED: { label: "Abgelaufen", cls: "bg-slate-100 text-slate-600" },
  DELETED: { label: "Gelöscht", cls: "bg-red-100 text-red-700" },
  PASSWORD_FAILED: { label: "Falsches Passwort", cls: "bg-amber-100 text-amber-800" },
  TRUST_CHECK_FAILED: { label: "Vertrauen abgelehnt", cls: "bg-orange-100 text-orange-800" },
};

const ACTOR_LABELS: Record<string, string> = {
  USER: "Mitarbeiter",
  CUSTOMER: "Bürger",
  SYSTEM: "System",
};

type PageProps = {
  searchParams: Promise<{ page?: string; event?: string }>;
};

export default async function AuditLogPage({ searchParams }: PageProps) {
  const session = await requireTenantAdmin();
  const tenantId = session.user.tenantId!;
  const { page: pageParam, event: eventFilter } = await searchParams;

  const page = Math.max(1, parseInt(pageParam ?? "1") || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where = {
    message: { tenantId },
    ...(eventFilter ? { eventType: eventFilter as never } : {}),
  };

  const [events, total] = await Promise.all([
    prisma.messageEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      include: {
        message: {
          select: {
            id: true,
            subjectPlain: true,
            subjectIsEncrypted: true,
            securityLevel: true,
            sender: { select: { firstName: true, lastName: true } },
            recipient: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    }),
    prisma.messageEvent.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (eventFilter) params.set("event", eventFilter);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/admin/audit${qs ? `?${qs}` : ""}`;
  }

  const EVENT_TYPES = Object.keys(EVENT_META);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit-Log</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {total.toLocaleString("de-DE")} Ereignisse insgesamt
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-1.5">
        <Link
          href="/admin/audit"
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            !eventFilter
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
          )}
        >
          Alle
        </Link>
        {EVENT_TYPES.map((et) => {
          const meta = EVENT_META[et]!;
          return (
            <Link
              key={et}
              href={`/admin/audit?event=${et}`}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                eventFilter === et
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
              )}
            >
              {meta.label}
            </Link>
          );
        })}
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-16 text-center">
          <ClipboardList className="mb-4 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Keine Ereignisse gefunden</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Zeitpunkt</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ereignis</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Akteur</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Nachricht</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Empfänger</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => {
                const meta = EVENT_META[ev.eventType];
                const subject = ev.message.subjectIsEncrypted
                  ? "🔒 Verschlüsselt"
                  : ev.message.subjectPlain ?? "—";
                return (
                  <tr
                    key={ev.id}
                    style={{ borderBottom: "1px solid #f1f5f9" }}
                    className="last:border-0 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
                      {format(ev.createdAt, "dd.MM.yy HH:mm:ss", { locale: de })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          meta?.cls ?? "bg-slate-100 text-slate-700",
                        )}
                      >
                        {meta?.label ?? ev.eventType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground">
                      {ACTOR_LABELS[ev.actorType] ?? ev.actorType}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <Link
                        href={`/inbox/${ev.messageId}`}
                        className="block truncate text-[13px] hover:underline"
                      >
                        {subject}
                      </Link>
                      <div className="text-[11px] text-muted-foreground">
                        Von {ev.message.sender.firstName} {ev.message.sender.lastName}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px]">
                      <div>{ev.message.recipient.firstName} {ev.message.recipient.lastName}</div>
                      <div className="text-[11px] text-muted-foreground">{ev.message.recipient.email}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderTop: "1px solid #f1f5f9", background: "#f8fafc" }}
            >
              <span className="text-[12px] text-muted-foreground">
                {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} von {total.toLocaleString("de-DE")}
              </span>
              <div className="flex items-center gap-1">
                {page > 1 ? (
                  <Link href={pageUrl(page - 1)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50">
                    <ChevronLeft className="h-3.5 w-3.5" /> Zurück
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-400 opacity-50">
                    <ChevronLeft className="h-3.5 w-3.5" /> Zurück
                  </span>
                )}
                {page < totalPages ? (
                  <Link href={pageUrl(page + 1)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50">
                    Weiter <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-400 opacity-50">
                    Weiter <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
