import { useState, useEffect, useRef } from "react";
import {
  Button,
  Field,
  Input,
  Spinner,
  MessageBar,
  MessageBarBody,
  Text,
  Title3,
  Divider,
  Link,
} from "@fluentui/react-components";
import { CheckmarkCircle20Filled, Phone20Regular } from "@fluentui/react-icons";
import { useOffice } from "@/hooks/useOffice";
import { RecipientSearch } from "@/components/RecipientSearch";
import { SecurityLevelPicker, type SecurityLevel } from "@/components/SecurityLevelPicker";
import { TrustelloClient, type CustomerResult } from "@/api/trustello";

type Props = {
  client: TrustelloClient;
  tenantName: string;
};

type SendState = "idle" | "uploading" | "sending" | "done" | "error";

export function ComposePage({ client, tenantName }: Props) {
  const { composeData, loading, error: officeError } = useOffice();
  const [recipient, setRecipient] = useState<CustomerResult | null>(null);
  const [securityLevel, setSecurityLevel] = useState<SecurityLevel>("LEVEL_2");
  const [password, setPassword] = useState("");
  const [sendState, setSendState] = useState<SendState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sentMessageId, setSentMessageId] = useState<string | null>(null);
  const hasAutoSearched = useRef(false);

  // Ersten Empfänger aus Outlook-Compose vorausfüllen
  const prefilledEmail = composeData?.to[0]?.address;

  // Nur ein automatischer Lookup beim ersten Laden
  useEffect(() => {
    if (!hasAutoSearched.current && prefilledEmail) {
      hasAutoSearched.current = true;
    }
  }, [prefilledEmail]);

  const isPasswordLevel = securityLevel === "LEVEL_3" || securityLevel === "LEVEL_4";
  const canSend = recipient !== null && (!isPasswordLevel || password.length >= 4);

  async function handleSend() {
    if (!recipient || !composeData) return;

    setSendState("uploading");
    setErrorMessage(null);

    try {
      // Anhänge hochladen
      const stagingKeys: string[] = [];
      for (const attachment of composeData.attachments) {
        const content = await new Promise<Office.AttachmentContent>((resolve, reject) => {
          (Office.context.mailbox.item as Office.MessageCompose).getAttachmentContentAsync(
            attachment.id,
            (result) => {
              if (result.status === Office.AsyncResultStatus.Succeeded) {
                resolve(result.value);
              } else {
                reject(new Error(result.error.message));
              }
            },
          );
        });

        const staged = await client.stageAttachment(
          content.content,
          attachment.name,
          attachment.attachmentType === Office.MailboxEnums.AttachmentType.File
            ? "application/octet-stream"
            : "message/rfc822",
        );
        stagingKeys.push(staged.stagingKey);
      }

      setSendState("sending");

      // Nachricht senden — Body je nach Sicherheitsstufe
      const body =
        securityLevel === "LEVEL_1" ? composeData.body : `Neue sichere Nachricht von ${tenantName}`;

      const result = await client.sendMessage({
        recipientId: recipient.id,
        subject: composeData.subject || "(kein Betreff)",
        body,
        securityLevel,
        ...(isPasswordLevel && password ? { password } : {}),
        attachmentStagingKeys: stagingKeys,
      });

      setSentMessageId(result.id);
      setSendState("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      setErrorMessage(msg);
      setSendState("error");
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <Spinner size="small" />
        <Text>Compose-Daten werden geladen...</Text>
      </div>
    );
  }

  if (officeError) {
    return (
      <div style={{ padding: 16 }}>
        <MessageBar intent="error">
          <MessageBarBody>{officeError}</MessageBarBody>
        </MessageBar>
      </div>
    );
  }

  if (sendState === "done" && sentMessageId) {
    return (
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CheckmarkCircle20Filled color="#16a34a" />
          <Title3 style={{ color: "#16a34a" }}>Nachricht gesendet!</Title3>
        </div>
        <Text>
          Die Nachricht wurde sicher über Trustello zugestellt.{" "}
          <Link href={`https://app.trustello.de/m/${sentMessageId}`} target="_blank">
            Nachricht ansehen
          </Link>
        </Text>
        <Text size={200} style={{ color: "#6b7280" }}>
          Sie können diesen Outlook-Entwurf jetzt verwerfen.
        </Text>
        <Button
          onClick={() => {
            setSendState("idle");
            setSentMessageId(null);
          }}
        >
          Neue Nachricht
        </Button>
      </div>
    );
  }

  const isSending = sendState === "uploading" || sendState === "sending";

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <Title3>Sicher über Trustello senden</Title3>

      {composeData && (
        <div style={{ padding: 8, background: "#f9fafb", borderRadius: 6, fontSize: 12 }}>
          <Text size={200} style={{ color: "#374151" }}>
            <strong>Betreff:</strong> {composeData.subject || "(kein Betreff)"}
            {composeData.attachments.length > 0 && (
              <span style={{ marginLeft: 8 }}>
                📎 {composeData.attachments.length} Anhang
                {composeData.attachments.length !== 1 ? "änge" : ""}
              </span>
            )}
          </Text>
        </div>
      )}

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
          Empfänger
        </label>
        <RecipientSearch
          client={client}
          selected={recipient}
          onSelect={setRecipient}
          prefilledEmail={prefilledEmail}
        />
      </div>

      <Divider />

      <SecurityLevelPicker value={securityLevel} onChange={setSecurityLevel} />

      {isPasswordLevel && (
        <Field label="Passwort für Empfänger">
          <Input
            type="text"
            placeholder="Zugangscode (mind. 4 Zeichen)"
            value={password}
            onChange={(_, d) => setPassword(d.value)}
          />
          {recipient?.mobilePhone ? (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              <Phone20Regular style={{ color: "#16a34a", width: 14, height: 14 }} />
              <Text size={100} style={{ color: "#16a34a" }}>
                Passwort wird per SMS zugestellt
              </Text>
            </div>
          ) : (
            <Text size={100} style={{ color: "#d97706", marginTop: 4 }}>
              ⚠ Kein Mobiltelefon hinterlegt — Passwort manuell übermitteln
            </Text>
          )}
        </Field>
      )}

      {sendState === "error" && errorMessage && (
        <MessageBar intent="error">
          <MessageBarBody>{errorMessage}</MessageBarBody>
        </MessageBar>
      )}

      <Button
        appearance="primary"
        onClick={() => void handleSend()}
        disabled={!canSend || isSending}
        style={{ marginTop: 4 }}
      >
        {sendState === "uploading" && (
          <>
            <Spinner size="tiny" style={{ marginRight: 6 }} /> Anhänge werden hochgeladen...
          </>
        )}
        {sendState === "sending" && (
          <>
            <Spinner size="tiny" style={{ marginRight: 6 }} /> Nachricht wird gesendet...
          </>
        )}
        {(sendState === "idle" || sendState === "error") && "Jetzt sicher senden"}
      </Button>
    </div>
  );
}
