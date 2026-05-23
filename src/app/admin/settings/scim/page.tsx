import { requireTenantAdmin } from "@/lib/auth-helpers";
import { getScimStatus } from "@/server/actions/scim-settings";
import { ScimCard } from "./ScimCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ScimSettingsPage() {
  await requireTenantAdmin();
  const status = await getScimStatus();

  const scimBaseUrl = `${process.env.NEXTAUTH_URL ?? "https://app.trustello.de"}/api/scim/v2`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SCIM 2.0 — Entra ID Synchronisation</h1>
        <p className="mt-1 text-muted-foreground">
          Verbinden Sie Azure AD / Entra ID um Mitarbeiter automatisch zu synchronisieren.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SCIM Bearer-Token</CardTitle>
          <CardDescription>
            Dieses Token autorisiert Entra ID, Benutzer in Trustello anzulegen und zu deaktivieren.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScimCard
            hasToken={status.hasToken}
            lastUsedAt={status.lastUsedAt}
            createdAt={status.createdAt}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entra-Konfiguration</CardTitle>
          <CardDescription>
            Werte für die Enterprise-App in Microsoft Entra Admin Center.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-1 text-sm font-medium">Tenant-URL (SCIM-Endpunkt)</p>
            <code className="block rounded bg-muted px-3 py-2 font-mono text-sm">
              {scimBaseUrl}
            </code>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Einrichtungsschritte in Entra:</p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>
                Entra Admin Center öffnen →{" "}
                <strong>Enterprise Applications → New Application → Non-gallery</strong>
              </li>
              <li>
                App erstellen → <strong>Provisioning → Provisioning Mode: Automatic</strong>
              </li>
              <li>
                Tenant-URL und Bearer-Token (oben) eintragen → <strong>Test Connection</strong>
              </li>
              <li>
                Attribut-Mapping prüfen:{" "}
                <Badge variant="outline" className="font-mono">
                  userPrincipalName → userName
                </Badge>{" "}
                ·{" "}
                <Badge variant="outline" className="font-mono">
                  givenName → name.givenName
                </Badge>
              </li>
              <li>Provisioning starten → Benutzer werden automatisch in Trustello angelegt</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
