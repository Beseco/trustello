import { requireCitizenAccount } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { resolveSenderLabel, securityLevelLabel } from "@/lib/message-display";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Inbox, Lock, ShieldCheck, ShieldAlert, Clock } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function PostfachInboxPage() {
  const { citizenAccountId, name } = await requireCitizenAccount();

  const customers = await prisma.customer.findMany({
    where: { citizenAccountId },
    select: { id: true },
  });
  const customerIds = customers.map((c) => c.id);

  const messages = customerIds.length > 0
    ? await prisma.message.findMany({
        where: { recipientId: { in: customerIds }, deletedAt: null },
        orderBy: { sentAt: "desc" },
        include: {
          tenant: { select: { name: true } },
          sender: { select: { firstName: true, lastName: true } },
          ou: { select: { name: true } },
        },
      })
    : [];

  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Posteingang</h1>
          <p className="text-sm text-slate-500">Willkommen, {name}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
          <ShieldCheck className="h-3.5 w-3.5" />
          Verschlüsselt
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed bg-white py-16 text-center">
          <Inbox className="h-12 w-12 text-slate-300" />
          <div>
            <p className="font-medium text-slate-700">Keine Nachrichten</p>
            <p className="mt-1 text-sm text-slate-400">
              Sobald eine Behörde Ihnen eine Nachricht sendet, erscheint sie hier.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map((msg) => {
            const isExpired = msg.expiresAt < now;
            const isNew = !msg.firstReadAt && !isExpired;
            const senderLabel = resolveSenderLabel(msg);
            const hasVault = !!msg.vaultMessageKey;

            return (
              <Link
                key={msg.id}
                href={isExpired ? "#" : `/postfach/nachrichten/${msg.id}`}
                className={`flex items-start gap-4 rounded-xl border bg-white p-4 transition-colors ${
                  isExpired
                    ? "cursor-default opacity-50"
                    : "hover:border-blue-200 hover:bg-blue-50/30"
                }`}
              >
                {/* Ungelesen-Indikator */}
                <div className="mt-1.5 shrink-0">
                  {isExpired ? (
                    <Clock className="h-4 w-4 text-slate-400" />
                  ) : hasVault ? (
                    <ShieldCheck className="h-4 w-4 text-blue-500" />
                  ) : (
                    <Lock className="h-4 w-4 text-slate-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {msg.tenant.name}
                    </span>
                    {isNew && (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        NEU
                      </span>
                    )}
                    {isExpired && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        Abgelaufen
                      </span>
                    )}
                  </div>
                  <p className={`mt-1 truncate text-sm ${isNew ? "font-semibold text-slate-900" : "text-slate-700"}`}>
                    {msg.subjectIsEncrypted ? "(verschlüsselter Betreff)" : (msg.subjectPlain ?? "(kein Betreff)")}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{senderLabel}</p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-xs text-slate-500">
                    {format(msg.sentAt, "dd.MM.yyyy", { locale: de })}
                  </p>
                  <Badge variant="outline" className="mt-1 text-[10px]">
                    {securityLevelLabel(msg.securityLevel)}
                  </Badge>
                  {hasVault && (
                    <p className="mt-1 text-[10px] font-medium text-blue-600">E2E</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
