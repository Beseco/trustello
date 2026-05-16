import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { unwrapTenantMasterKey, unwrapMessageKey, decrypt } from "@/lib/crypto/envelope";
import { logger } from "@/lib/logger";
import { AlertTriangle, Mail, Paperclip, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { de } from "date-fns/locale";
// Anhänge werden über den authentifizierten Proxy-Endpunkt ausgeliefert
// — kein presigned S3-URL mehr (verhindert URL-Leakage in Browser-History etc.)
import { PasswordUnlockForm } from "./PasswordUnlockForm";
import { MagicLinkRequestForm } from "./MagicLinkRequestForm";
import { ReplyForm } from "./ReplyForm";
import { cookies } from "next/headers";
import { verifyCookieValue } from "@/app/api/auth/magic-link/route";
import { auth } from "@/lib/auth";
import { sendMail } from "@/lib/mail/send";
import { readReceiptTemplate } from "@/lib/mail/templates/read-receipt";
import { meetsMinTrust } from "@/lib/trust";
import { LegalFooter } from "./LegalFooter";
import { RichTextPreview } from "@/components/RichTextPreview";

type PageProps = {
  params: Promise<{ messageId: string }>;
  searchParams: Promise<{ error?: string }>;
};

const SECURITY_LEVEL_LABELS: Record<string, string> = {
  LEVEL_1: "Stufe 1",
  LEVEL_2: "Stufe 2 — Verschlüsselt",
  LEVEL_3: "Stufe 3 — Passwortgeschützt",
  LEVEL_4: "Stufe 4 — Höchste Sicherheit",
};

export default async function CitizenMessagePage({ params, searchParams }: PageProps) {
  const { messageId } = await params;
  const { error: linkError } = await searchParams;

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      tenant: {
        select: {
          name: true,
          tenantMasterKey: true,
          tmkIv: true,
          tmkAuthTag: true,
          settings: { select: { imprintHtml: true, privacyPolicyHtml: true } },
        },
      },
      sender: { select: { firstName: true, lastName: true, email: true } },
      recipient: { select: { firstName: true, lastName: true } },
      _count: { select: { events: { where: { eventType: "REPLIED" } } } },
      attachments: {
        where: { virusScanStatus: "CLEAN" },
        select: {
          id: true,
          filenameCiphertext: true,
          filenameIv: true,
          filenameAuthTag: true,
          mimeType: true,
          sizeBytes: true,
          storageKey: true,
          contentIv: true,
          contentAuthTag: true,
        },
      },
    },
  });

  if (!message || message.deletedAt) notFound();

  const now = new Date();
  const isExpired = message.expiresAt < now;

  if (isExpired) {
    return (
      <MessageShell
      tenantName={message.tenant.name}
      imprintHtml={message.tenant.settings?.imprintHtml}
      privacyPolicyHtml={message.tenant.settings?.privacyPolicyHtml}
    >
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <p className="font-semibold">Diese Nachricht ist abgelaufen</p>
          <p className="text-sm text-muted-foreground">
            Abgelaufen am {format(message.expiresAt, "dd. MMMM yyyy", { locale: de })}
          </p>
        </div>
      </MessageShell>
    );
  }

  if (message.securityLevel === "LEVEL_3" || message.securityLevel === "LEVEL_4") {
    return (
      <MessageShell
      tenantName={message.tenant.name}
      imprintHtml={message.tenant.settings?.imprintHtml}
      privacyPolicyHtml={message.tenant.settings?.privacyPolicyHtml}
    >
        <PasswordUnlockForm
          messageId={messageId}
          passwordHint={message.passwordHint}
        />
      </MessageShell>
    );
  }

  // Enforce minTrustLevel gate via magic-link session cookie OR logged-in customer session
  const needsEmailVerification = !meetsMinTrust("NONE", message.minTrustLevel);
  if (needsEmailVerification) {
    const [cookieStore, session] = await Promise.all([cookies(), auth()]);

    // Logged-in customer who is the recipient counts as EMAIL-verified
    const customerSessionVerified =
      session?.user?.userType === "customer" && session.user.id === message.recipientId;

    if (!customerSessionVerified) {
      const sessionCookie = cookieStore.get("ml_session");
      const verified = sessionCookie ? verifyCookieValue(sessionCookie.value) : null;
      const isVerified = verified?.messageId === messageId;

      if (!isVerified) {
        return (
          <MessageShell
            tenantName={message.tenant.name}
            imprintHtml={message.tenant.settings?.imprintHtml}
            privacyPolicyHtml={message.tenant.settings?.privacyPolicyHtml}
          >
            <MagicLinkRequestForm
              messageId={messageId}
              linkError={linkError === "link-expired"}
            />
          </MessageShell>
        );
      }
    }
  }

  // Decrypt
  let subjectText = "(kein Betreff)";
  let bodyText = "";
  type DecryptedAttachment = { id: string; filename: string; mimeType: string; sizeBytes: bigint; downloadUrl: string };
  const decryptedAttachments: DecryptedAttachment[] = [];

  try {
    const tmk = unwrapTenantMasterKey({
      tenantMasterKey: Buffer.from(message.tenant.tenantMasterKey),
      tmkIv: Buffer.from(message.tenant.tmkIv),
      tmkAuthTag: Buffer.from(message.tenant.tmkAuthTag),
    });

    const mk = unwrapMessageKey(
      {
        messageKey: Buffer.from(message.messageKey),
        messageKeyIv: Buffer.from(message.messageKeyIv),
        messageKeyAuthTag: Buffer.from(message.messageKeyAuthTag),
      },
      tmk,
    );

    bodyText = decrypt(
      {
        ciphertext: Buffer.from(message.bodyCiphertext),
        iv: Buffer.from(message.bodyIv),
        authTag: Buffer.from(message.bodyAuthTag),
      },
      mk,
    ).toString("utf-8");

    if (
      message.subjectIsEncrypted &&
      message.subjectCiphertext &&
      message.subjectIv &&
      message.subjectAuthTag
    ) {
      subjectText = decrypt(
        {
          ciphertext: Buffer.from(message.subjectCiphertext),
          iv: Buffer.from(message.subjectIv),
          authTag: Buffer.from(message.subjectAuthTag),
        },
        mk,
      ).toString("utf-8");
    } else if (message.subjectPlain) {
      subjectText = message.subjectPlain;
    }

    // Dateinamen entschlüsseln — Download-URL zeigt auf den Proxy-Endpunkt
    // (kein S3-Presigned-URL; Cookie-Auth läuft über /m/[messageId]/attachments/[id])
    for (const att of message.attachments) {
      const filename = decrypt(
        {
          ciphertext: Buffer.from(att.filenameCiphertext),
          iv: Buffer.from(att.filenameIv),
          authTag: Buffer.from(att.filenameAuthTag),
        },
        mk,
      ).toString("utf-8");

      const downloadUrl = `/m/${messageId}/attachments/${att.id}`;
      decryptedAttachments.push({ id: att.id, filename, mimeType: att.mimeType, sizeBytes: att.sizeBytes, downloadUrl });
    }
  } catch (err) {
    logger.error({ messageId, err }, "Failed to decrypt message");
    return (
      <MessageShell
      tenantName={message.tenant.name}
      imprintHtml={message.tenant.settings?.imprintHtml}
      privacyPolicyHtml={message.tenant.settings?.privacyPolicyHtml}
    >
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <p className="font-semibold">Fehler beim Entschlüsseln</p>
          <p className="text-sm text-muted-foreground">Bitte wenden Sie sich an den Absender.</p>
        </div>
      </MessageShell>
    );
  }

  // Record open event
  if (!message.firstReadAt) {
    const recipientName = `${message.recipient?.firstName ?? ""} ${message.recipient?.lastName ?? ""}`.trim();
    const subjectLine = message.subjectIsEncrypted ? "(verschlüsselt)" : (message.subjectPlain ?? "(kein Betreff)");

    await Promise.all([
      prisma.message.update({ where: { id: messageId }, data: { firstReadAt: now, lastReadAt: now } }),
      prisma.messageEvent.create({
        data: { messageId, eventType: "OPENED", actorType: "CUSTOMER", actorId: message.recipientId },
      }),
      sendMail({
        to: message.sender.email,
        subject: "Lesebestätigung – Ihre Nachricht wurde geöffnet",
        html: readReceiptTemplate({ recipientName, subject: subjectLine, readAt: now }),
      }).catch(() => undefined),
    ]);
  } else {
    await prisma.message.update({ where: { id: messageId }, data: { lastReadAt: now } });
  }

  const senderName = `${message.sender.firstName} ${message.sender.lastName}`;
  const sentDate = format(message.sentAt, "dd. MMMM yyyy, HH:mm 'Uhr'", { locale: de });
  const expiresDate = format(message.expiresAt, "dd. MMMM yyyy", { locale: de });

  function formatBytes(bytes: bigint): string {
    const n = Number(bytes);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <MessageShell
      tenantName={message.tenant.name}
      imprintHtml={message.tenant.settings?.imprintHtml}
      privacyPolicyHtml={message.tenant.settings?.privacyPolicyHtml}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{subjectText}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Von <span className="font-medium">{senderName}</span> · {sentDate}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 text-xs">
            {SECURITY_LEVEL_LABELS[message.securityLevel] ?? message.securityLevel}
          </Badge>
        </div>

        <div className="rounded-md border bg-muted/30 p-4">
          <RichTextPreview html={bodyText} />
        </div>

        {decryptedAttachments.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Paperclip className="h-4 w-4" />
              {decryptedAttachments.length} Anhang{decryptedAttachments.length > 1 ? "e" : ""}
            </p>
            <ul className="space-y-1">
              {decryptedAttachments.map((att) => (
                <li key={att.id} className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <span className="flex-1 truncate">{att.filename}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(att.sizeBytes)}</span>
                  <a
                    href={att.downloadUrl}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Herunterladen
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mail className="h-3 w-3" />
          <span>Verfügbar bis {expiresDate}</span>
        </div>

        {message.allowReply && !isExpired && message._count.events === 0 && (
          <ReplyForm messageId={messageId} allowAttachments={message.allowReplyAttach} />
        )}
        {message.allowReply && !isExpired && message._count.events > 0 && (
          <p className="text-xs text-muted-foreground">Sie haben auf diese Nachricht bereits geantwortet.</p>
        )}
      </div>
    </MessageShell>
  );
}

function MessageShell({
  tenantName,
  imprintHtml,
  privacyPolicyHtml,
  children,
}: {
  tenantName: string;
  imprintHtml?: string | null;
  privacyPolicyHtml?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/20 p-4">
      <div className="w-full max-w-xl space-y-4">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Trustello · Sicherer Postausgang
          </p>
          <p className="mt-1 text-sm font-medium">{tenantName}</p>
        </div>
        <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">{children}</div>
        <LegalFooter imprintHtml={imprintHtml} privacyPolicyHtml={privacyPolicyHtml} />
      </div>
    </div>
  );
}
