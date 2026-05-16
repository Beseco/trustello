import { notFound } from "next/navigation";
import { RichTextPreview } from "@/components/RichTextPreview";
import { requireEmployee } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { unwrapTenantMasterKey, unwrapMessageKey, decrypt } from "@/lib/crypto/envelope";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Paperclip,
  AlertTriangle,
  Send,
  User,
  Clock,
  ShieldCheck,
  Trash2,
  Reply,
} from "lucide-react";
import { EmployeePasswordUnlockForm } from "./EmployeePasswordUnlockForm";
import { AttachmentDownloadButton } from "./AttachmentDownloadButton";
import { DeleteMessageButton } from "./DeleteMessageButton";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SECURITY_LEVEL_LABELS: Record<string, { label: string; color: string }> = {
  LEVEL_1: { label: "Stufe 1 — Standard", color: "#94a3b8" },
  LEVEL_2: { label: "Stufe 2 — Verschlüsselt", color: "#3b82f6" },
  LEVEL_3: { label: "Stufe 3 — Passwortgeschützt", color: "#f59e0b" },
  LEVEL_4: { label: "Stufe 4 — Höchste Sicherheit", color: "#ef4444" },
};

function formatBytes(bytes: bigint): string {
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function decryptMessage(
  message: {
    messageKey: Uint8Array;
    messageKeyIv: Uint8Array;
    messageKeyAuthTag: Uint8Array;
    bodyCiphertext: Uint8Array;
    bodyIv: Uint8Array;
    bodyAuthTag: Uint8Array;
    subjectIsEncrypted: boolean;
    subjectCiphertext: Uint8Array | null;
    subjectIv: Uint8Array | null;
    subjectAuthTag: Uint8Array | null;
    subjectPlain: string | null;
    attachments: Array<{
      id: string;
      filenameCiphertext: Uint8Array;
      filenameIv: Uint8Array;
      filenameAuthTag: Uint8Array;
      mimeType: string;
      sizeBytes: bigint;
      virusScanStatus: string;
    }>;
  },
  tmk: Buffer,
): Promise<{
  subject: string;
  body: string | null;
  attachments: Array<{ id: string; filename: string; mimeType: string; sizeBytes: bigint; scanStatus: string }>;
  error: boolean;
}> {
  try {
    const mk = unwrapMessageKey(
      {
        messageKey: Buffer.from(message.messageKey),
        messageKeyIv: Buffer.from(message.messageKeyIv),
        messageKeyAuthTag: Buffer.from(message.messageKeyAuthTag),
      },
      tmk,
    );

    const body = decrypt(
      {
        ciphertext: Buffer.from(message.bodyCiphertext),
        iv: Buffer.from(message.bodyIv),
        authTag: Buffer.from(message.bodyAuthTag),
      },
      mk,
    ).toString("utf-8");

    let subject = message.subjectPlain ?? "(kein Betreff)";
    if (message.subjectIsEncrypted && message.subjectCiphertext && message.subjectIv && message.subjectAuthTag) {
      subject = decrypt(
        {
          ciphertext: Buffer.from(message.subjectCiphertext),
          iv: Buffer.from(message.subjectIv),
          authTag: Buffer.from(message.subjectAuthTag),
        },
        mk,
      ).toString("utf-8");
    }

    const attachments = message.attachments.map((att) => {
      const filename = decrypt(
        {
          ciphertext: Buffer.from(att.filenameCiphertext),
          iv: Buffer.from(att.filenameIv),
          authTag: Buffer.from(att.filenameAuthTag),
        },
        mk,
      ).toString("utf-8");
      return { id: att.id, filename, mimeType: att.mimeType, sizeBytes: att.sizeBytes, scanStatus: att.virusScanStatus };
    });

    return { subject, body, attachments, error: false };
  } catch {
    return { subject: "(Entschlüsselung fehlgeschlagen)", body: null, attachments: [], error: true };
  }
}

type PageProps = {
  params: Promise<{ messageId: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default async function MessageDetailPage({ params, searchParams }: PageProps) {
  const session = await requireEmployee();
  const { tenantId } = await getTenantContext();
  const { messageId } = await params;
  const { from } = await searchParams;

  const attachmentSelect = {
    id: true,
    filenameCiphertext: true,
    filenameIv: true,
    filenameAuthTag: true,
    mimeType: true,
    sizeBytes: true,
    virusScanStatus: true,
  };

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      tenant: { select: { tenantMasterKey: true, tmkIv: true, tmkAuthTag: true } },
      sender: { select: { id: true, firstName: true, lastName: true, email: true } },
      recipient: { select: { id: true, firstName: true, lastName: true, email: true } },
      attachments: { select: attachmentSelect },
      events: { orderBy: { createdAt: "asc" }, select: { eventType: true, createdAt: true, actorType: true } },
      // Parent (original message this is a reply to)
      parent: {
        include: {
          sender: { select: { firstName: true, lastName: true } },
          recipient: { select: { firstName: true, lastName: true } },
          attachments: { select: attachmentSelect },
        },
      },
      // Replies (citizen replies to this message)
      replies: {
        where: { deletedAt: null },
        orderBy: { sentAt: "asc" },
        include: {
          attachments: { select: attachmentSelect },
          events: { select: { eventType: true, actorType: true, createdAt: true } },
        },
      },
    },
  });

  if (!message || message.tenantId !== tenantId || message.deletedAt) notFound();

  // Zugriffskontrolle: Nur Sender oder Empfänger dürfen die Nachricht lesen.
  // Verhindert, dass Mitarbeiter fremde Nachrichten durch direkte URL-Eingabe aufrufen.
  const userId = session.user.id!;
  const userIsParty = message.senderId === userId || message.recipientId === userId;
  if (!userIsParty) notFound();

  const isIncomingReply = message.events.some(
    (e) => e.eventType === "SENT" && e.actorType === "CUSTOMER",
  );
  const isSentByMe = message.senderId === session.user.id && !isIncomingReply;
  const isPasswordProtected = message.securityLevel === "LEVEL_3" || message.securityLevel === "LEVEL_4";
  const isExpired = message.expiresAt < new Date();

  // Mark incoming reply as read
  if (isIncomingReply && !message.firstReadAt) {
    await prisma.message.update({
      where: { id: messageId },
      data: { firstReadAt: new Date(), lastReadAt: new Date() },
    });
  }

  const tmk = unwrapTenantMasterKey({
    tenantMasterKey: Buffer.from(message.tenant.tenantMasterKey),
    tmkIv: Buffer.from(message.tenant.tmkIv),
    tmkAuthTag: Buffer.from(message.tenant.tmkAuthTag),
  });

  // Decrypt main message
  const mainDecrypted = isPasswordProtected
    ? { subject: message.subjectPlain ?? "(passwortgeschützt)", body: null, attachments: [], error: false }
    : await decryptMessage(message, tmk);

  // Decrypt parent (if this is a reply)
  const parentDecrypted = message.parent
    ? await decryptMessage(message.parent, tmk)
    : null;

  // Decrypt all replies (if this is original)
  const repliesDecrypted = await Promise.all(
    message.replies.map((r) => decryptMessage(r, tmk).then((d) => ({ ...d, id: r.id, sentAt: r.sentAt, firstReadAt: r.firstReadAt, events: r.events }))),
  );

  const secLevel = SECURITY_LEVEL_LABELS[message.securityLevel];
  const backHref = from === "sent" ? "/inbox?filter=sent" : "/inbox";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Back */}
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {isIncomingReply ? "Zurück zum Posteingang" : "Zurück zu Gesendet"}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {isIncomingReply ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                <Reply className="h-3 w-3" /> Bürger-Antwort
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                <Send className="h-3 w-3" /> Gesendet
              </span>
            )}
            {isExpired && (
              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
                Abgelaufen
              </span>
            )}
          </div>
          <h1 className="mt-2 text-xl font-semibold">{mainDecrypted.subject}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isIncomingReply && (
            <Link
              href={`/m/${messageId}`}
              target="_blank"
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/50"
            >
              <ExternalLink className="h-3 w-3" />
              Bürger-Ansicht
            </Link>
          )}
          <DeleteMessageButton messageId={messageId} />
        </div>
      </div>

      {/* Parent message context (if this is a reply) */}
      {message.parent && parentDecrypted && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Ursprüngliche Nachricht
          </p>
          <p className="font-medium text-foreground">{parentDecrypted.subject}</p>
          <p className="mt-0.5 text-muted-foreground">
            Von {message.parent.sender.firstName} {message.parent.sender.lastName} an{" "}
            {message.parent.recipient.firstName} {message.parent.recipient.lastName} ·{" "}
            {format(message.parent.sentAt, "dd.MM.yyyy, HH:mm", { locale: de })} Uhr
          </p>
          <Link
            href={`/inbox/${message.parent.id}?from=sent`}
            className="mt-1.5 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            Originalnachricht öffnen
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Main message card */}
      <Card className="overflow-hidden">
        {/* Meta header */}
        <CardHeader className="border-b bg-slate-50/80 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                {isIncomingReply ? (
                  <span>
                    <span className="text-muted-foreground">Von: </span>
                    <span className="font-semibold">
                      {message.recipient.firstName} {message.recipient.lastName}
                    </span>
                    <span className="ml-1 text-muted-foreground">(Bürger)</span>
                  </span>
                ) : (
                  <span>
                    <span className="text-muted-foreground">An: </span>
                    <Link
                      href={`/customers/${message.recipient.id}`}
                      className="font-semibold hover:underline"
                    >
                      {message.recipient.firstName} {message.recipient.lastName}
                    </Link>
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({message.recipient.email})
                    </span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {format(message.sentAt, "dd. MMMM yyyy, HH:mm 'Uhr'", { locale: de })}
                  <span className="ml-1.5 text-xs">
                    ({formatDistanceToNow(message.sentAt, { addSuffix: true, locale: de })})
                  </span>
                </span>
              </div>
              {!isIncomingReply && (
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span
                    className="text-xs font-medium"
                    style={{ color: secLevel?.color }}
                  >
                    {secLevel?.label ?? message.securityLevel}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-1.5 text-xs">
              {message.firstReadAt ? (
                <span className="chip chip-green">Gelesen</span>
              ) : (
                <span className="chip chip-amber">Ungelesen</span>
              )}
              {!isIncomingReply && message.replies.length > 0 && (
                <span className="chip chip-gray">
                  {message.replies.length} Antwort{message.replies.length > 1 ? "en" : ""}
                </span>
              )}
              <span className="text-muted-foreground">
                Bis {format(message.expiresAt, "dd.MM.yyyy", { locale: de })}
              </span>
            </div>
          </div>
        </CardHeader>

        {/* Body */}
        <CardContent className="px-6 py-5">
          {isPasswordProtected ? (
            <EmployeePasswordUnlockForm messageId={messageId} passwordHint={message.passwordHint} />
          ) : mainDecrypted.error ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p>Fehler beim Entschlüsseln der Nachricht.</p>
            </div>
          ) : (
            <RichTextPreview html={mainDecrypted.body ?? ""} />
          )}
        </CardContent>

        {/* Attachments */}
        {mainDecrypted.attachments.length > 0 && (
          <div className="border-t bg-slate-50/60 px-6 py-4">
            <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
              <Paperclip className="h-3.5 w-3.5" />
              {mainDecrypted.attachments.length} Anhang{mainDecrypted.attachments.length > 1 ? "e" : ""}
            </p>
            <ul className="space-y-1.5">
              {mainDecrypted.attachments.map((att) => (
                <li
                  key={att.id}
                  className="flex items-center gap-3 rounded-md border bg-white px-3 py-2 text-sm"
                >
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate font-medium">{att.filename}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(att.sizeBytes)}</span>
                  {att.scanStatus === "CLEAN" && att.filename !== "(verschlüsselt)" ? (
                    <AttachmentDownloadButton attachmentId={att.id} filename={att.filename} />
                  ) : att.scanStatus === "INFECTED" ? (
                    <Badge variant="destructive" className="text-xs">Schadsoftware</Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Citizen replies thread (for outgoing messages) */}
      {!isIncomingReply && repliesDecrypted.length > 0 && (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Reply className="h-3.5 w-3.5" />
            {repliesDecrypted.length} Bürger-Antwort{repliesDecrypted.length > 1 ? "en" : ""}
          </p>
          {repliesDecrypted.map((reply) => (
            <Card
              key={reply.id}
              className={cn(
                "overflow-hidden border-l-4",
                !reply.firstReadAt ? "border-l-blue-400 bg-blue-50/30" : "border-l-slate-200",
              )}
            >
              <CardHeader className="border-b bg-slate-50/60 px-5 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">
                    {message.recipient.firstName} {message.recipient.lastName}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">(Bürger)</span>
                  </span>
                  <div className="flex items-center gap-3">
                    {!reply.firstReadAt && (
                      <span className="chip chip-blue">Neu</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {format(reply.sentAt, "dd.MM.yyyy, HH:mm 'Uhr'", { locale: de })}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-5 py-4">
                {reply.error ? (
                  <p className="text-sm text-destructive">Fehler beim Entschlüsseln.</p>
                ) : (
                  <RichTextPreview html={reply.body ?? ""} />
                )}
              </CardContent>
              {reply.attachments.length > 0 && (
                <div className="border-t bg-slate-50/40 px-5 py-3">
                  <ul className="space-y-1.5">
                    {reply.attachments.map((att) => (
                      <li key={att.id} className="flex items-center gap-2 rounded border bg-white px-3 py-1.5 text-sm">
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="flex-1 truncate">{att.filename}</span>
                        <span className="text-xs text-muted-foreground">{formatBytes(att.sizeBytes)}</span>
                        {att.scanStatus === "CLEAN" && (
                          <AttachmentDownloadButton attachmentId={att.id} filename={att.filename} />
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Sidebar info as horizontal footer bar */}
      <div className="rounded-lg border bg-white px-5 py-4">
        <div className="flex flex-wrap gap-6 text-xs text-muted-foreground">
          <div>
            <p className="font-semibold uppercase tracking-wide">Gelesen</p>
            <p className="mt-0.5">
              {message.firstReadAt
                ? format(message.firstReadAt, "dd.MM.yyyy, HH:mm 'Uhr'", { locale: de })
                : "Noch nicht geöffnet"}
            </p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wide">Läuft ab</p>
            <p className={cn("mt-0.5", isExpired && "text-destructive font-medium")}>
              {format(message.expiresAt, "dd. MMMM yyyy", { locale: de })}
            </p>
          </div>
          {!isIncomingReply && (
            <div>
              <p className="font-semibold uppercase tracking-wide">Antworten erlaubt</p>
              <p className="mt-0.5">{message.allowReply ? "Ja" : "Nein"}</p>
            </div>
          )}
          <div className="ml-auto flex items-center">
            <DeleteMessageButton messageId={messageId} variant="text" />
          </div>
        </div>
      </div>
    </div>
  );
}
