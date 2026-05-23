import { useState } from "react";
import {
  Button,
  Field,
  Input,
  Spinner,
  MessageBar,
  MessageBarBody,
  Title3,
  Text,
  Avatar,
  Divider,
} from "@fluentui/react-components";
import { SignOut24Regular } from "@fluentui/react-icons";
import { useSettings } from "@/hooks/useSettings";

export function SettingsPage() {
  const { settings, saveSettings } = useSettings();
  const isLoggedIn = !!settings.token;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${settings.serverUrl}/api/addin/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Anmeldung fehlgeschlagen.");
      }

      const data = (await res.json()) as {
        token: string;
        user: { firstName: string; lastName: string };
        tenant: { name: string };
      };

      await saveSettings({
        token: data.token,
        serverUrl: settings.serverUrl,
        userName: `${data.user.firstName} ${data.user.lastName}`,
        tenantName: data.tenant.name,
      });

      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch(`${settings.serverUrl}/api/addin/auth`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${settings.token}` },
      });
    } catch {
      // Fehler ignorieren — lokal trotzdem abmelden
    } finally {
      await saveSettings({ token: "", serverUrl: settings.serverUrl, userName: "", tenantName: "" });
      setLoading(false);
    }
  }

  if (isLoggedIn) {
    return (
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        <Title3>Angemeldet</Title3>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={settings.userName} size={40} />
          <div>
            <Text weight="semibold" block>
              {settings.userName}
            </Text>
            <Text size={200} style={{ color: "#666" }}>
              {settings.tenantName}
            </Text>
          </div>
        </div>

        <Divider />

        <Button
          icon={<SignOut24Regular />}
          onClick={handleLogout}
          disabled={loading}
          appearance="subtle"
        >
          {loading ? <Spinner size="tiny" /> : "Abmelden"}
        </Button>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <Title3>Anmelden</Title3>
      <Text size={200} style={{ color: "#555" }}>
        Melden Sie sich mit Ihren Trustello-Zugangsdaten an.
      </Text>

      <Field label="E-Mail">
        <Input
          type="email"
          value={email}
          onChange={(_, d) => setEmail(d.value)}
          placeholder="name@behoerde.de"
          disabled={loading}
        />
      </Field>

      <Field label="Passwort">
        <Input
          type="password"
          value={password}
          onChange={(_, d) => setPassword(d.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleLogin();
          }}
          disabled={loading}
        />
      </Field>

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      <Button
        appearance="primary"
        onClick={handleLogin}
        disabled={loading || !email || !password}
      >
        {loading ? <Spinner size="tiny" /> : "Anmelden"}
      </Button>
    </div>
  );
}
