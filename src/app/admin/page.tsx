import { requireTenantAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import {
  Users, Building2, HardDrive, Mail, MailOpen, MessageSquare,
  Reply, AlertTriangle, ArrowRight, PenSquare, UserPlus,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { de } from "date-fns/locale";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireTenantAdmin();
  const tenantId = session.user.tenantId!;

  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now, { locale: de });
  const monthStart = startOfMonth(now);

  const [
    tenant,
    userCount,
    activeUserCount,
    ouCount,
    // Message stats
    sentTotal,
    sentToday,
    sentThisWeek,
    sentThisMonth,
    readCount,
    unreadCount,
    repliedCount,
    expiringSoon,
    // Recent messages
    recentMessages,
    // Recent replies
    recentReplies,
  ] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      include: { plan: true, settings: true },
    }),
    prisma.user.count({ where: { tenantId } }),
    prisma.user.count({ where: { tenantId, isActive: true } }),
    prisma.organisationUnit.count({ where: { tenantId } }),
    // Messages
    prisma.message.count({
      where: { tenantId, deletedAt: null, events: { some: { eventType: "SENT", actorType: "USER" } } },
    }),
    prisma.message.count({
      where: { tenantId, deletedAt: null, sentAt: { gte: todayStart }, events: { some: { eventType: "SENT", actorType: "USER" } } },
    }),
    prisma.message.count({
      where: { tenantId, deletedAt: null, sentAt: { gte: weekStart }, events: { some: { eventType: "SENT", actorType: "USER" } } },
    }),
    prisma.message.count({
      where: { tenantId, deletedAt: null, sentAt: { gte: monthStart }, events: { some: { eventType: "SENT", actorType: "USER" } } },
    }),
    prisma.message.count({
      where: { tenantId, deletedAt: null, firstReadAt: { not: null }, events: { some: { eventType: "SENT", actorType: "USER" } } },
    }),
    prisma.message.count({
      where: { tenantId, deletedAt: null, firstReadAt: null, expiresAt: { gt: now }, events: { some: { eventType: "SENT", actorType: "USER" } } },
    }),
    prisma.message.count({
      where: { tenantId, deletedAt: null, events: { some: { eventType: "REPLIED", actorType: "CUSTOMER" } } },
    }),
    prisma.message.count({
      where: { tenantId, deletedAt: null, expiresAt: { gt: now, lte: new Date(now.getTime() + 7 * 86400000) } },
    }),
    // Recent sent messages
    prisma.message.findMany({
      where: { tenantId, deletedAt: null, events: { some: { eventType: "SENT", actorType: "USER" } } },
      orderBy: { sentAt: "desc" },
      take: 5,
      select: {
        id: true,
        subjectPlain: true,
        subjectIsEncrypted: true,
        sentAt: true,
        firstReadAt: true,
        sender: { select: { firstName: true, lastName: true } },
        recipient: { select: { firstName: true, lastName: true } },
        _count: { select: { events: { where: { eventType: "REPLIED" } } } },
      },
    }),
    // Recent citizen replies
    prisma.message.findMany({
      where: { tenantId, deletedAt: null, events: { some: { eventType: "SENT", actorType: "CUSTOMER" } } },
      orderBy: { sentAt: "desc" },
      take: 4,
      select: {
        id: true,
        sentAt: true,
        firstReadAt: true,
        recipient: { select: { firstName: true, lastName: true } },
        parent: { select: { id: true, subjectPlain: true, subjectIsEncrypted: true } },
      },
    }),
  ]);

  const storageGB = Number(tenant.storageUsedBytes) / 1024 ** 3;
  const storagePct = Math.min(100, (storageGB / tenant.plan.storageGB) * 100);
  const userPct = Math.min(100, (activeUserCount / tenant.plan.maxUsers) * 100);
  const readRate = sentTotal > 0 ? Math.round((readCount / sentTotal) * 100) : 0;

  const statusLabel: Record<string, string> = {
    ACTIVE: "Aktiv", TRIAL: "Test", SUSPENDED: "Gesperrt", CANCELLED: "Gekündigt",
  };
  const statusChip: Record<string, string> = {
    ACTIVE: "chip chip-green", TRIAL: "chip chip-amber", SUSPENDED: "chip chip-red", CANCELLED: "chip chip-gray",
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{tenant.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Plan: <span className="font-medium text-foreground">{tenant.plan.name}</span>
            </p>
          </div>
          <span className={statusChip[tenant.status] ?? "chip chip-gray"}>
            {statusLabel[tenant.status] ?? tenant.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:bg-muted/50"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Benutzer einladen
          </Link>
          <Link
            href="/compose"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <PenSquare className="h-3.5 w-3.5" />
            Neue Nachricht
          </Link>
        </div>
      </div>

      {/* Stat cards row 1 — Nachrichten */}
      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Nachrichten
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Heute"
            value={sentToday}
            sub="Gesendet"
            icon={<Mail className="h-4 w-4" />}
            accent="#1e40af"
          />
          <StatCard
            title="Diese Woche"
            value={sentThisWeek}
            sub="Gesendet"
            icon={<Mail className="h-4 w-4" />}
            accent="#0891b2"
          />
          <StatCard
            title="Diesen Monat"
            value={sentThisMonth}
            sub="Gesendet"
            icon={<Mail className="h-4 w-4" />}
            accent="#059669"
          />
          <StatCard
            title="Lesequote"
            value={`${readRate} %`}
            sub={`${readCount} von ${sentTotal} gelesen`}
            icon={<MailOpen className="h-4 w-4" />}
            accent={readRate >= 70 ? "#059669" : readRate >= 40 ? "#d97706" : "#dc2626"}
          />
        </div>
      </div>

      {/* Stat cards row 2 — Status */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Ungelesen"
          value={unreadCount}
          sub="Noch nicht geöffnet"
          icon={<MessageSquare className="h-4 w-4" />}
          accent={unreadCount > 0 ? "#d97706" : "#94a3b8"}
        />
        <StatCard
          title="Bürger-Antworten"
          value={repliedCount}
          sub="Eingegangen"
          icon={<Reply className="h-4 w-4" />}
          accent="#7c3aed"
        />
        <StatCard
          title="Ablaufend"
          value={expiringSoon}
          sub="In 7 Tagen"
          icon={<AlertTriangle className="h-4 w-4" />}
          accent={expiringSoon > 0 ? "#dc2626" : "#94a3b8"}
        />
        <StatCard
          title="Gesamt"
          value={sentTotal}
          sub="Alle Nachrichten"
          icon={<Mail className="h-4 w-4" />}
          accent="#475569"
        />
      </div>

      {/* Main content: recent messages + sidebar */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Recent messages */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Zuletzt gesendet
            </p>
            <Link href="/inbox?filter=sent" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
              Alle anzeigen <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="overflow-hidden rounded-lg border bg-white">
            {recentMessages.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                Noch keine Nachrichten gesendet.
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Von</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">An</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Betreff</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Wann</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMessages.map((msg) => (
                    <tr key={msg.id} style={{ borderBottom: "1px solid #f1f5f9" }} className="hover:bg-slate-50 last:border-0">
                      <td className="px-4 py-3 text-[13px]">
                        {msg.sender.firstName} {msg.sender.lastName.charAt(0)}.
                      </td>
                      <td className="px-4 py-3 text-[13px] font-medium">
                        {msg.recipient.firstName} {msg.recipient.lastName}
                      </td>
                      <td className="px-4 py-3 max-w-[180px]">
                        <Link href={`/inbox/${msg.id}`} className="block truncate text-[13px] text-slate-600 hover:underline">
                          {msg.subjectIsEncrypted ? "🔒 Verschlüsselt" : (msg.subjectPlain ?? "—")}
                        </Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[12px] text-muted-foreground">
                        {formatDistanceToNow(msg.sentAt, { addSuffix: true, locale: de })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {msg.firstReadAt
                            ? <span className="chip chip-green">Gelesen</span>
                            : <span className="chip chip-amber">Ungelesen</span>
                          }
                          {msg._count.events > 0 && <span className="chip chip-gray">Antwort</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Recent replies */}
          {recentReplies.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Neue Bürger-Antworten
                </p>
                <Link href="/inbox" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                  Posteingang <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {recentReplies.map((reply) => (
                  <Link
                    key={reply.id}
                    href={`/inbox/${reply.id}`}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors hover:bg-slate-50 ${!reply.firstReadAt ? "border-blue-200 bg-blue-50/40" : "bg-white"}`}
                  >
                    <div className="flex items-center gap-3">
                      <Reply className={`h-4 w-4 shrink-0 ${!reply.firstReadAt ? "text-blue-500" : "text-muted-foreground"}`} />
                      <div>
                        <p className={`font-medium ${!reply.firstReadAt ? "text-blue-700" : "text-foreground"}`}>
                          {reply.recipient.firstName} {reply.recipient.lastName}
                          {!reply.firstReadAt && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-blue-500 align-middle" />}
                        </p>
                        {reply.parent && (
                          <p className="text-xs text-muted-foreground truncate max-w-xs">
                            Re: {reply.parent.subjectIsEncrypted ? "🔒 Verschlüsselt" : (reply.parent.subjectPlain ?? "—")}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                      {formatDistanceToNow(reply.sentAt, { addSuffix: true, locale: de })}
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">

          {/* Plan & Limits */}
          <div className="rounded-lg border bg-white p-5">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Plan & Limits
            </p>
            <div className="space-y-4">
              {/* Users */}
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Benutzer</span>
                  <span className="font-semibold">{activeUserCount} / {tenant.plan.maxUsers}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${userPct}%`,
                      background: userPct >= 90 ? "#dc2626" : userPct >= 70 ? "#d97706" : "#1e40af",
                    }}
                  />
                </div>
              </div>
              {/* Storage */}
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Speicher</span>
                  <span className="font-semibold">{storageGB.toFixed(2)} GB / {tenant.plan.storageGB} GB</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${storagePct}%`,
                      background: storagePct >= 90 ? "#dc2626" : storagePct >= 70 ? "#d97706" : "#059669",
                    }}
                  />
                </div>
              </div>
              {/* Retention */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Aufbewahrung</span>
                <span className="font-semibold">
                  {tenant.settings?.retentionDaysOverride ?? tenant.plan.retentionDays} Tage
                </span>
              </div>
              {/* Max file size */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Max. Anhang</span>
                <span className="font-semibold">{tenant.plan.maxFileSizeMB} MB</span>
              </div>
            </div>
          </div>

          {/* Organisation */}
          <div className="rounded-lg border bg-white p-5">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Organisation
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> Benutzer gesamt
                </span>
                <Link href="/admin/users" className="font-semibold hover:underline">{userCount}</Link>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" /> Organisationseinheiten
                </span>
                <Link href="/admin/organisation" className="font-semibold hover:underline">{ouCount}</Link>
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div className="rounded-lg border bg-white p-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Schnellzugriff
            </p>
            <div className="space-y-1">
              {[
                { href: "/admin/users", label: "Benutzer verwalten", icon: <Users className="h-3.5 w-3.5" /> },
                { href: "/admin/organisation", label: "Organisation", icon: <Building2 className="h-3.5 w-3.5" /> },
                { href: "/admin/audit", label: "Audit-Log", icon: <HardDrive className="h-3.5 w-3.5" /> },
                { href: "/admin/settings/templates", label: "Globale Vorlagen", icon: <MessageSquare className="h-3.5 w-3.5" /> },
                { href: "/admin/settings", label: "Einstellungen", icon: <HardDrive className="h-3.5 w-3.5" /> },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                >
                  {l.icon}
                  {l.label}
                  <ArrowRight className="ml-auto h-3.5 w-3.5 opacity-40" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title, value, sub, icon, accent,
}: {
  title: string;
  value: number | string;
  sub: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border bg-white p-5" style={{ borderTop: `3px solid ${accent}` }}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <p className="mt-2 text-[28px] font-bold leading-none text-foreground">{value}</p>
      <p className="mt-1 text-[12px] text-muted-foreground">{sub}</p>
    </div>
  );
}
