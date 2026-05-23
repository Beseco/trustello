import { useState, useEffect } from "react";
import {
  Tab,
  TabList,
  Spinner,
  MessageBar,
  MessageBarBody,
  Text,
} from "@fluentui/react-components";
import { useSettings } from "@/hooks/useSettings";
import { TrustelloClient, type TenantInfo } from "@/api/trustello";
import { ComposePage } from "@/pages/ComposePage";
import { SettingsPage } from "@/pages/SettingsPage";

type ActiveTab = "compose" | "settings";

export function App() {
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<ActiveTab>("compose");
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(() => !!settings.token);

  // Kein Token → direkt auf Einstellungen (Login-Seite)
  const effectiveTab: ActiveTab = !settings.token ? "settings" : activeTab;

  useEffect(() => {
    if (!settings.token) return;
    let cancelled = false;
    const client = new TrustelloClient(settings.serverUrl, settings.token);
    client
      .getMe()
      .then((info: TenantInfo) => {
        if (cancelled) return;
        setTenantInfo(info);
        setInitError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setInitError(err instanceof Error ? err.message : "Verbindungsfehler");
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [settings.token, settings.serverUrl]);

  if (initializing) {
    return (
      <div style={{ padding: 24, display: "flex", alignItems: "center", gap: 8 }}>
        <Spinner size="small" />
        <Text>Trustello wird geladen...</Text>
      </div>
    );
  }

  const client = new TrustelloClient(settings.serverUrl, settings.token);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Header */}
      <div
        style={{
          padding: "8px 16px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            background: "#1e40af",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          T
        </div>
        <Text weight="semibold" style={{ flex: 1 }}>
          Trustello
          {tenantInfo && (
            <span style={{ fontWeight: 400, color: "#6b7280", marginLeft: 6, fontSize: 12 }}>
              {tenantInfo.tenantName}
            </span>
          )}
        </Text>
      </div>

      {/* Navigation — nur anzeigen wenn eingeloggt */}
      {settings.token && (
        <TabList
          selectedValue={effectiveTab}
          onTabSelect={(_, d) => setActiveTab(d.value as ActiveTab)}
          style={{ padding: "0 8px", borderBottom: "1px solid #e5e7eb" }}
        >
          <Tab value="compose">Senden</Tab>
          <Tab value="settings">Konto</Tab>
        </TabList>
      )}

      {/* Error Banner */}
      {initError && (
        <MessageBar intent="warning" style={{ margin: "8px 16px" }}>
          <MessageBarBody>{initError}</MessageBarBody>
        </MessageBar>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {effectiveTab === "compose" && tenantInfo ? (
          <ComposePage client={client} tenantName={tenantInfo.tenantName} />
        ) : effectiveTab === "compose" && !tenantInfo ? (
          <div style={{ padding: 16 }}>
            <Text>Verbindung wird hergestellt...</Text>
          </div>
        ) : (
          <SettingsPage />
        )}
      </div>
    </div>
  );
}
