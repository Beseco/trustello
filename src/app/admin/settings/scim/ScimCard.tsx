"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { generateScimToken, deleteScimToken } from "@/server/actions/scim-settings";
import { AlertTriangle, CheckCircle, Copy, Trash2 } from "lucide-react";

type Props = {
  hasToken: boolean;
  lastUsedAt: Date | null;
  createdAt: Date | null;
};

export function ScimCard({ hasToken: initialHasToken, lastUsedAt, createdAt }: Props) {
  const [hasToken, setHasToken] = useState(initialHasToken);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setGeneratedToken(null);
    try {
      const result = await generateScimToken();
      setGeneratedToken(result.token);
      setHasToken(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("SCIM-Token wirklich löschen? Die Entra-Synchronisation wird unterbrochen."))
      return;
    setLoading(true);
    try {
      await deleteScimToken();
      setHasToken(false);
      setGeneratedToken(null);
    } finally {
      setLoading(false);
    }
  }

  async function copyToken() {
    if (!generatedToken) return;
    await navigator.clipboard.writeText(generatedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            {hasToken ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
            <span className="font-medium">{hasToken ? "Token konfiguriert" : "Kein Token"}</span>
          </div>
          {hasToken && createdAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Erstellt: {new Date(createdAt).toLocaleDateString("de-DE")}
              {lastUsedAt && (
                <> · Zuletzt verwendet: {new Date(lastUsedAt).toLocaleDateString("de-DE")}</>
              )}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleGenerate} disabled={loading}>
            {hasToken ? "Neu generieren" : "Token generieren"}
          </Button>
          {hasToken && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {generatedToken && (
        <Alert>
          <AlertTitle className="text-amber-700">
            Token jetzt kopieren — wird nur einmal angezeigt
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <div className="flex gap-2">
              <Input value={generatedToken} readOnly className="font-mono text-xs" />
              <Button size="sm" variant="outline" onClick={copyToken}>
                {copied ? "Kopiert!" : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Hinterlegen Sie diesen Token in Ihrer Entra-Enterprise-App unter{" "}
              <strong>Provisioning → Secret Token</strong>.
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
