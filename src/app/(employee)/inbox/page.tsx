import { requireEmployee } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { Inbox, Plus, Mail, MailOpen, Search, ChevronLeft, ChevronRight, Paperclip, Send, Reply } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow, startOfMonth } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SECURITY_LEVEL_CHIPS: Record<string, { label: string; cls: string }> = {
  LEVEL_1: { label: "Stufe 1", cls: "chip chip-blue" },
  LEVEL_2: { label: "Stufe 2", cls: "chip chip-blue" },
  LEVEL_3: { label: "Stufe 3", cls: "chip chip-amber" },
  LEVEL_4: { label: "Stufe 4", cls: "chip chip-red" },
};

const PAGE_SIZE = 50;

type Filter = "inbox" | "sent" | "all";

type PageProps = {
  searchParams: Promise<{ filter?: string; q?: string; page?: string }>;
};

export default async function InboxPage({ searchParams }: PageProps) {
  const session = await requireEmployee();
  const tenantId = session.user.tenantId!;
  const userId = session.user.id!;
  const { filter, q, page: pageParam } = await searchParams;

  const activeFilter: Filter =
    filter === "sent" ? "sent" : filter === "all" ? "all" : "inbox";

  const page = Math.max(1, parseInt(pageParam ?? "1") || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const isAdmin = (session.user as { roles?: string[] }).roles?.some(
    (r) => r === "TENANT_ADMIN" || r === "USER_MANAGER",
  );

  const now = new Date();
  const monthStart = startOfMonth(now);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Search across subject + customer name
  const searchFilter = q
    ? {
        OR: [
          { subjectPlain: { contains: q, mode: "insensitive" as const } },
          { recipient: { firstName: { contains: q, mode: "insensitive" as const } } },
          { recipient: { lastName: { contains: q, mode: "insensitive" as const } } },
          { recipient: { email: { contains: q, mode: "insensitive" as const } } },
          { sender: { firstName: { contains: q, mode: "insensitive" as const } } },
          { sender: { lastName: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};

  // "Posteingang" = citizen replies addressed to this employee
  const inboxWhere = {
    tenantId,
    deletedAt: null,
    recipientId: userId,
    events: { some: { eventType: "SENT" as const, actorType: "CUSTOMER" as const } },
    ...searchFilter,
  };

  // "Gesendet" = messages sent by employee to citizens
  const sentWhere = {
    tenantId,
    deletedAt: null,
    senderId: userId,
    events: { some: { eventType: "SENT" as const, actorType: "USER" as const } },
    ...searchFilter,
  };

  // "Alle" = kombinierte Ansicht (eigene gesendete + empfangene Nachrichten)
  // Kein Zugriff auf Nachrichten anderer Mitarbeiter — das wäre ein Datenschutzverstoß.
  // Admin-spezifische Aufsicht über alle Nachrichten: separate Entscheidung ausstehend.
  const allWhere = {
    tenantId,
    deletedAt: null,
    OR: [{ senderId: userId }, { recipientId: userId }],
    ...searchFilter,
  };

  const where =
    activeFilter === "sent"
      ? sentWhere
      : activeFilter === "all" && isAdmin
        ? allWhere
        : inboxWhere;

  const messageSelect = {
    id: true,
    subjectIsEncrypted: true,
    subjectPlain: true,
    securityLevel: true,
    sentAt: true,
    firstReadAt: true,
    expiresAt: true,
    senderId: true,
    recipientId: true,
    recipient: { select: { firstName: true, lastName: true, email: true } },
    sender: { select: { firstName: true, lastName: true } },
    _count: {
      select: {
        events: { where: { eventType: "REPLIED" as const } },
        attachments: true,
      },
    },
  };

  const [messages, total, inboxUnread, sentThisMonth, repliedCount, expiringSoon] =
    await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: { sentAt: "desc" },
        skip,
        take: PAGE_SIZE,
        select: messageSelect,
      }),
      prisma.message.count({ where }),
      // Unread incoming replies
      prisma.message.count({
        where: {
          tenantId,
          deletedAt: null,
          recipientId: userId,
          firstReadAt: null,
          expiresAt: { gt: now },
          events: { some: { eventType: "SENT", actorType: "CUSTOMER" } },
        },
      }),
      // Sent this month
      prisma.message.count({
        where: {
          tenantId,
          deletedAt: null,
          senderId: userId,
          sentAt: { gte: monthStart },
          events: { some: { eventType: "SENT", actorType: "USER" } },
        },
      }),
      // Sent messages that received a reply
      prisma.message.count({
        where: {
          tenantId,
          deletedAt: null,
          senderId: userId,
          events: {
            some: { eventType: "SENT", actorType: "USER" },
          },
          AND: [{ events: { some: { eventType: "REPLIED", actorType: "CUSTOMER" } } }],
        },
      }),
      // Expiring soon
      prisma.message.count({
        where: {
          tenantId,
          deletedAt: null,
          senderId: userId,
          expiresAt: { gt: now, lte: sevenDaysFromNow },
        },
      }),
    ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (activeFilter !== "inbox") params.set("filter", activeFilter);
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/inbox${qs ? `?${qs}` : ""}`;
  }

  const tabs: { id: Filter; label: string; icon: React.ReactNode; badge?: number; show: boolean }[] = [
    {
      id: "inbox",
      label: "Posteingang",
      icon: <Inbox className="h-3.5 w-3.5" />,
      badge: inboxUnread || undefined,
      show: true,
    },
    {
      id: "sent",
      label: "Gesendet",
      icon: <Send className="h-3.5 w-3.5" />,
      show: true,
    },
    {
      id: "all",
      label: "Alle",
      icon: <Reply className="h-3.5 w-3.5" />,
      show: !!isAdmin,
    },
  ];

  const emptyMessages = {
    inbox: {
      title: "Keine Antworten von Bürgern",
      sub: "Sobald Bürger auf Ihre Nachrichten antworten, erscheinen sie hier.",
    },
    sent: {
      title: "Keine gesendeten Nachrichten",
      sub: "Gesendete Nachrichten erscheinen hier.",
    },
    all: {
      title: "Keine Nachrichten vorhanden",
      sub: "",
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Nachrichten</h1>
        <Link
          href="/compose"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />
          Neue Nachricht
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Posteingang"
          value={inboxUnread}
          sub="Ungelesene Antworten"
          accentColor={inboxUnread > 0 ? "#1e40af" : "#94a3b8"}
        />
        <StatCard
          label="Gesendet"
          value={sentThisMonth}
          sub="Diesen Monat"
          accentColor="#059669"
        />
        <StatCard
          label="Beantwortet"
          value={repliedCount}
          sub="Bürger-Antworten erhalten"
          accentColor="#7c3aed"
        />
        <StatCard
          label="Ablaufend"
          value={expiringSoon}
          sub="In 7 Tagen"
          accentColor={expiringSoon > 0 ? "#dc2626" : "#94a3b8"}
        />
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          {tabs
            .filter((t) => t.show)
            .map((tab) => (
              <Link
                key={tab.id}
                href={`/inbox?filter=${tab.id}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[13px] font-medium border-[1.5px] transition-colors",
                  activeFilter === tab.id
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {tab.icon}
                {tab.label}
                {tab.badge != null && tab.badge > 0 && (
                  <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white leading-none">
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
              </Link>
            ))}
        </div>

        <form method="GET" className="relative ml-auto">
          <input type="hidden" name="filter" value={activeFilter} />
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Name oder Betreff…"
            className="pl-8 w-56 text-sm bg-white"
          />
        </form>
      </div>

      {/* Message list */}
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-white p-16 text-center">
          <Inbox className="mb-4 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">{emptyMessages[activeFilter].title}</p>
          {emptyMessages[activeFilter].sub && (
            <p className="mt-1 text-sm text-muted-foreground">{emptyMessages[activeFilter].sub}</p>
          )}
          {activeFilter === "sent" && (
            <Link
              href="/compose"
              className="mt-4 inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Erste Nachricht verfassen
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-9" />
                {(activeFilter === "all" || activeFilter === "inbox") && (
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {activeFilter === "inbox" ? "Von" : "Absender"}
                  </th>
                )}
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {activeFilter === "inbox" ? "An" : "Empfänger"}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Betreff
                </th>
                {activeFilter !== "inbox" && (
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Sicherheit
                  </th>
                )}
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {activeFilter === "inbox" ? "Erhalten" : "Gesendet"}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {messages.map((msg) => {
                const isExpired = msg.expiresAt < now;
                const recipientName = `${msg.recipient.firstName} ${msg.recipient.lastName}`;
                const senderName = `${msg.sender.firstName} ${msg.sender.lastName}`;
                const subject = msg.subjectIsEncrypted ? "🔒 Verschlüsselt" : (msg.subjectPlain ?? "—");
                const timeAgo = formatDistanceToNow(msg.sentAt, { addSuffix: true, locale: de });
                const hasReply = msg._count.events > 0;
                const attachmentCount = msg._count.attachments;
                const chip = SECURITY_LEVEL_CHIPS[msg.securityLevel];
                const isUnread = !msg.firstReadAt && !isExpired;
                const isIncoming = activeFilter === "inbox";

                return (
                  <tr
                    key={msg.id}
                    style={{ borderBottom: "1px solid #f1f5f9" }}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-slate-50 last:border-0",
                      isUnread && isIncoming && "bg-blue-50/40",
                    )}
                  >
                    {/* Read indicator */}
                    <td className="px-4 py-3">
                      <Link href={`/inbox/${msg.id}`} className="flex">
                        {msg.firstReadAt ? (
                          <MailOpen className="h-4 w-4 text-slate-400" />
                        ) : (
                          <Mail className={cn("h-4 w-4", isIncoming ? "text-blue-600" : "text-blue-400")} />
                        )}
                      </Link>
                    </td>

                    {/* From (for inbox + all) */}
                    {(activeFilter === "all" || activeFilter === "inbox") && (
                      <td className="px-4 py-3">
                        <Link href={`/inbox/${msg.id}`} className="block">
                          {activeFilter === "inbox" ? (
                            <div className="text-[13.5px] font-semibold text-foreground">
                              {recipientName}
                              <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">(Bürger)</span>
                            </div>
                          ) : (
                            <div className="text-[13px] text-muted-foreground">{senderName}</div>
                          )}
                        </Link>
                      </td>
                    )}

                    {/* To */}
                    <td className="px-4 py-3">
                      <Link href={`/inbox/${msg.id}`} className="block">
                        {activeFilter === "sent" ? (
                          <>
                            <div className="text-[13.5px] font-semibold text-foreground">{recipientName}</div>
                            <div className="text-[12px] text-muted-foreground">{msg.recipient.email}</div>
                          </>
                        ) : (
                          <div className="text-[13px] text-muted-foreground">{recipientName}</div>
                        )}
                      </Link>
                    </td>

                    {/* Subject */}
                    <td className="px-4 py-3 max-w-xs">
                      <Link
                        href={`/inbox/${msg.id}`}
                        className={cn(
                          "flex items-center gap-1.5 text-[13.5px] hover:underline",
                          isUnread && isIncoming ? "font-semibold text-foreground" : "text-slate-600",
                        )}
                      >
                        <span className="truncate">{subject}</span>
                        {attachmentCount > 0 && (
                          <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground">
                            <Paperclip className="h-3 w-3" />
                            {attachmentCount}
                          </span>
                        )}
                      </Link>
                    </td>

                    {/* Security (not shown for inbox) */}
                    {activeFilter !== "inbox" && (
                      <td className="px-4 py-3">
                        <span className={chip?.cls ?? "chip chip-gray"}>
                          {chip?.label ?? msg.securityLevel}
                        </span>
                      </td>
                    )}

                    {/* Time */}
                    <td className="px-4 py-3 whitespace-nowrap text-[12px] text-muted-foreground">
                      {timeAgo}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {isExpired ? (
                          <span className="chip chip-red">Abgelaufen</span>
                        ) : activeFilter === "inbox" ? (
                          msg.firstReadAt ? (
                            <span className="chip chip-green">Gelesen</span>
                          ) : (
                            <span className="chip chip-blue">Neu</span>
                          )
                        ) : (
                          <>
                            {msg.firstReadAt ? (
                              <span className="chip chip-green">Gelesen</span>
                            ) : (
                              <span className="chip chip-amber">Ungelesen</span>
                            )}
                            {hasReply && <span className="chip chip-gray">Beantwortet</span>}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderTop: "1px solid #f1f5f9", background: "#f8fafc" }}
            >
              <span className="text-[12px] text-muted-foreground">
                {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} von {total} Nachrichten
              </span>
              <div className="flex items-center gap-1">
                {page > 1 ? (
                  <Link
                    href={pageUrl(page - 1)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Zurück
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-400 opacity-50">
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Zurück
                  </span>
                )}
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <Link
                      key={p}
                      href={pageUrl(p)}
                      className={cn(
                        "inline-flex h-7 min-w-7 items-center justify-center rounded-md border text-[12px] font-medium px-2",
                        page === p
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                      )}
                    >
                      {p}
                    </Link>
                  );
                })}
                {page < totalPages ? (
                  <Link
                    href={pageUrl(page + 1)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Weiter
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-400 opacity-50">
                    Weiter
                    <ChevronRight className="h-3.5 w-3.5" />
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

function StatCard({
  label,
  value,
  sub,
  accentColor,
}: {
  label: string;
  value: number | string;
  sub: string;
  accentColor: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-lg border bg-white p-5"
      style={{ borderTop: `3px solid ${accentColor}` }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 text-[28px] font-bold leading-none text-foreground">{value}</p>
      <p className="mt-1 text-[12px] text-muted-foreground">{sub}</p>
    </div>
  );
}
