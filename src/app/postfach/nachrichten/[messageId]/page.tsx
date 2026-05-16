import { requireCitizenAccount } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { resolveSenderLabel } from "@/lib/message-display";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, ShieldCheck, Lock, Paperclip, Download, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { decryptMessageForCitizen } from "@/server/actions/citizen-vault";
import { RichTextPreview } from "@/components/RichTextPreview";
import { VaultUnlockCard } from "./VaultUnlockCard";

type Props = { params: Promise<{ messageId: string }> };

const SECURITY_LEVEL_LABELS: Record<string, string> = {
  LEVEL_1: "Standard",
  LEVEL_2: "Verschlüsselt",
  LEVEL_3: "Passwortgeschützt",
  LEVEL_4: "Höchste Sicherheit",
};

export const dynamic = "force-dynamic";

export default async function NachrichtDetailPage({ params }: Props) {
  const { messageId } = await params;
  const { citizenAccountId } = await requireCitizenAccount();

  // Zugriffsprüfung: Nachricht gehört zu einem Customer dieses CitizenAccounts
  const customers = await prisma.customer.findMany({
    where: { citizenAccountId },
    select: { id: true },
  });
  const customerIds = customers.map((c) => c.id);

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      tenant: { select: { name: true, settings: { select: { imprintHtml: true } } } },
      sender: { select: { firstName: true, lastName: true } },
      ou: { select: { name: true } },
      attachments: {
        where: { virusScanStatus: "CLEAN" },
        select: { id: true, mimeType: true, sizeBytes: true },
      },
    },
  });

  if (!message || message.deletedAt || !customerIds.includes(message.recipientId)) {
    notFound();
  }

  const isExpired = message.expiresAt < new Date();
  const hasVault = !!message.vaultMessageKey;
  const senderLabel = resolveSenderLabel(message);

  if (isExpired) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link href="/postfach/inbox" className="mb-6 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Zurück zum Posteingang
        </Link>
        <div className="flex flex-col items-center gap-3 rounded-2xl border bg-white py-16 text-center shadow-sm">
          <Clock className="h-12 w-12 text-slate-300" />
          <p className="font-semibold text-slate-700">Diese Nachricht ist abgelaufen</p>
          <p className="text-sm text-slate-400">
            Abgelaufen am {format(message.expiresAt, "dd. MMMM yyyy", { locale: de })}
          </p>
        </div>
      </div>
    );
  }

  // LEVEL_3/4: Passwort-basiert — leite auf /m/[messageId] weiter (bestehender Flow)
  if (message.securityLevel === "LEVEL_3" || message.securityLevel === "LEVEL_4") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href="/postfach/inbox" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Zurück zum Posteingang
        </Link>
        <div className="rounded-2xl border bg-white p-6 shadow-sm text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <p className="font-semibold">Passwortgeschützte Nachricht</p>
          <p className="mt-2 text-sm text-slate-500">Diese Nachricht erfordert ein separates Passwort.</p>
          <a
            href={`/m/${messageId}`}
            className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Nachricht mit Passwort öffnen
          </a>
        </div>
      </div>
    );
  }

  // Vault-Nachricht: Client-seitiger Unlock
  if (hasVault) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href="/postfach/inbox" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Zurück zum Posteingang
        </Link>
        <MessageHeader
          senderLabel={senderLabel}
          sentAt={message.sentAt}
          securityLevel={message.securityLevel}
          isVault={true}
        />
        <VaultUnlockCard
          messageId={messageId}
          attachmentCount={message.attachments.length}
          attachmentIds={message.attachments.map(a => a.id)}
          attachmentMimeTypes={message.attachments.reduce((acc, a) => ({ ...acc, [a.id]: a.mimeType }), {} as Record<string, string>)}
          attachmentSizes={message.attachments.reduce((acc, a) => ({ ...acc, [a.id]: Number(a.sizeBytes) }), {} as Record<string, number>)}
        />
        <MessageFooter expiresAt={message.expiresAt} />
      </div>
    );
  }

  // Standard-Entschlüsselung über TMK (LEVEL_1/2 ohne Vault)
  const decryptResult = await decryptMessageForCitizen(messageId);

  if (!decryptResult.ok) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href="/postfach/inbox" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>
        <div className="rounded-2xl border bg-white p-6 shadow-sm text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-red-500" />
          <p className="font-semibold">Entschlüsselung fehlgeschlagen</p>
          <p className="mt-2 text-sm text-slate-500">{decryptResult.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/postfach/inbox" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Zurück zum Posteingang
      </Link>

      <MessageHeader
        senderLabel={senderLabel}
        sentAt={message.sentAt}
        securityLevel={message.securityLevel}
        isVault={false}
        subject={decryptResult.subject}
      />

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <RichTextPreview html={decryptResult.body} />
      </div>

      {message.attachments.length > 0 && (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <Paperclip className="h-4 w-4" />
            {message.attachments.length} Anhang{message.attachments.length > 1 ? "e" : ""}
          </p>
          <ul className="space-y-2">
            {message.attachments.map((att) => (
              <li key={att.id} className="flex items-center gap-3 rounded-lg border bg-slate-50 px-3 py-2 text-sm">
                <span className="flex-1 truncate">{decryptResult.attachmentFilenames[att.id] ?? "Anhang"}</span>
                <span className="shrink-0 text-xs text-slate-400">{formatBytes(Number(att.sizeBytes))}</span>
                <a
                  href={`/m/${messageId}/attachments/${att.id}`}
                  className="flex shrink-0 items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  <Download className="h-3.5 w-3.5" />
                  Herunterladen
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <MessageFooter expiresAt={message.expiresAt} />
    </div>
  );
}

function MessageHeader({
  senderLabel,
  sentAt,
  securityLevel,
  isVault,
  subject,
}: {
  senderLabel: string;
  sentAt: Date;
  securityLevel: string;
  isVault: boolean;
  subject?: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {subject && <h1 className="truncate text-lg font-bold text-slate-900">{subject}</h1>}
          <p className="mt-1 text-sm text-slate-600">{senderLabel}</p>
          <p className="text-xs text-slate-400">
            {format(sentAt, "dd. MMMM yyyy, HH:mm 'Uhr'", { locale: de })}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge variant="outline" className="text-xs">{SECURITY_LEVEL_LABELS[securityLevel] ?? securityLevel}</Badge>
          {isVault ? (
            <div className="flex items-center gap-1 text-[11px] font-medium text-blue-600">
              <ShieldCheck className="h-3.5 w-3.5" />
              Ende-zu-Ende verschlüsselt
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Lock className="h-3.5 w-3.5" />
              Serverseitig verschlüsselt
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageFooter({ expiresAt }: { expiresAt: Date }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-400">
      <Clock className="h-3.5 w-3.5" />
      Verfügbar bis {format(expiresAt, "dd. MMMM yyyy", { locale: de })}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
