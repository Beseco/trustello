import { useState } from "react";
import {
  Button,
  Field,
  Input,
  Spinner,
  MessageBar,
  MessageBarBody,
  Title3,
} from "@fluentui/react-components";
import { useSettings } from "@/hooks/useSettings";
import { TrustelloClient } from "@/api/trustello";

export function SettingsPage() {
  const { settings, saveSettings } = useSettings();
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [serverUrl, setServerUrl] = useState(settings.serverUrl);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSave() {
    setSaving(true);
    setStatus(null);
    try {
      await saveSettings({ apiKey, serverUrl });
      setStatus({ ok: true, message: "Einstellungen gespeichert." });
    } catch {
      setStatus({ ok: false, message: "Speichern fehlgeschlagen." });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setStatus(null);
    try {
      const client = new TrustelloClient(serverUrl, apiKey);
      const me = await client.getMe();
      setStatus({ ok: true, message: `Verbunden mit: ${me.tenantName}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Verbindung fehlgeschlagen";
      setStatus({ ok: false, message: msg });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <Title3>Trustello Einstellungen</Title3>

      <Field label="Server-URL">
        <Input
          type="url"
          value={serverUrl}
          onChange={(_, d) => setServerUrl(d.value)}
          placeholder="https://app.trustello.de"
        />
      </Field>

      <Field label="API-Key">
        <Input
          type="password"
          value={apiKey}
          onChange={(_, d) => setApiKey(d.value)}
          placeholder="tk_..."
        />
      </Field>

      {status && (
        <MessageBar intent={status.ok ? "success" : "error"}>
          <MessageBarBody>{status.message}</MessageBarBody>
        </MessageBar>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <Button appearance="primary" onClick={handleSave} disabled={saving}>
          {saving ? <Spinner size="tiny" /> : "Speichern"}
        </Button>
        <Button onClick={handleTest} disabled={testing || !apiKey}>
          {testing ? <Spinner size="tiny" /> : "Verbindung testen"}
        </Button>
      </div>
    </div>
  );
}
