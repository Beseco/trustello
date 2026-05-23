import { useState, useEffect } from "react";

export type ComposeData = {
  to: Array<{ name: string; address: string }>;
  subject: string;
  body: string;
  attachments: Office.AttachmentDetails[];
};

function getAsync<T>(fn: (callback: (result: Office.AsyncResult<T>) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    fn((result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        resolve(result.value);
      } else {
        reject(new Error(result.error.message));
      }
    });
  });
}

export function useOffice() {
  const [composeData, setComposeData] = useState<ComposeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bestimme ob wir im Compose-Kontext sind
  const isCompose =
    Office.context.mailbox.item?.itemType === Office.MailboxEnums.ItemType.Message &&
    Office.context.requirements.isSetSupported("Mailbox", "1.1");

  useEffect(() => {
    async function loadComposeData() {
      const item = Office.context.mailbox.item;
      if (!item) {
        setError("Kein Compose-Element gefunden.");
        setLoading(false);
        return;
      }

      try {
        const [recipients, subject, body] = await Promise.all([
          getAsync<Office.EmailAddressDetails[]>((cb) =>
            (item as Office.MessageCompose).to.getAsync(cb),
          ),
          getAsync<string>((cb) => (item as Office.MessageCompose).subject.getAsync(cb)),
          getAsync<string>((cb) =>
            (item as Office.MessageCompose).body.getAsync(Office.CoercionType.Text, cb),
          ),
        ]);

        // attachments ist in den Office.js-Typen nur bei ItemRead als direktes Array typisiert;
        // im Compose-Kontext ist es ebenfalls verfügbar, aber als generische Property
        const attachments: Office.AttachmentDetails[] =
          "attachments" in item
            ? (item as unknown as { attachments: Office.AttachmentDetails[] }).attachments
            : [];

        setComposeData({
          to: recipients.map((r) => ({ name: r.displayName, address: r.emailAddress })),
          subject,
          body,
          attachments,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      } finally {
        setLoading(false);
      }
    }

    void loadComposeData();
  }, []);

  return { composeData, loading, error, isCompose };
}
