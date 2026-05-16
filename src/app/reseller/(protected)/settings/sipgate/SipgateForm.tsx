"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, Eye, EyeOff, Trash2 } from "lucide-react";
import {
  saveResellerSipgateConfig,
  deleteResellerSipgateConfig,
  testResellerSipgateConfig,
  type SipgateConfigData,
} from "@/server/actions/sipgate-settings";

type Props = {
  initial: SipgateConfigData | null;
};

export function SipgateForm({ initial }: Props) {
  const [tokenId, setTokenId] = useState(initial?.tokenId ?? "");
  const [token, setToken] = useState("");
  const [smsId, setSmsId] = useState(initial?.smsId ?? "s0");
  const [testPhone, setTestPhone] = useState("");
  const [showToken, setShowToken] = useState(false);

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [isSaving, startSave] = useTransition();
  const [isTesting, startTest] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  const hasExisting = !!initial;

  function handleSave() {
    setError(null);
    setSaved(false);
    startSave(async () => {
      const result = await saveResellerSipgateConfig({ tokenId, token: token || undefined, smsId });
      if (result.ok) {
        setSaved(true);
        setToken(""); // Token-Feld leeren nach Speichern
        setTimeout(() => setSaved(false), 4000);
      } else {
        setError(result.error);
      }
    });
  }

  function handleTest() {
    setTestResult(null);
    setError(null);
    startTest(async () => {
      const result = await testResellerSipgateConfig({
        tokenId,
        token: token || undefined,
        smsId,
        testPhone,
      });
      setTestResult({
        ok: result.ok,
        message: result.ok
          ? "Test-SMS wurde erfolgreich gesendet!"
          : `Fehler: ${"error" in result ? result.error : "Unbekannter Fehler"}`,
      });
    });
  }

  function handleDelete() {
    if (!confirm("sipgate-Konfiguration wirklich löschen?")) return;
    setError(null);
    startDelete(async () => {
      const result = await deleteResellerSipgateConfig();
      if (result.ok) {
        setTokenId("");
        setToken("");
        setSmsId("s0");
        setTestResult(null);
      } else {
        setError("error" in result ? result.error : "Löschen fehlgeschlagen");
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Token-ID */}
      <div className="space-y-1.5">
        <Label htmlFor="tokenId">Token-ID</Label>
        <Input
          id="tokenId"
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
          placeholder="token1234567890"
        />
        <p className="text-xs text-muted-foreground">
          Zu finden unter app.sipgate.com → Einstellungen → Personal Access Token
        </p>
      </div>

      {/* Token */}
      <div className="space-y-1.5">
        <Label htmlFor="token">
          Token{" "}
          {hasExisting && (
            <span className="font-normal text-muted-foreground">(leer lassen um bestehendes zu behalten)</span>
          )}
        </Label>
        <div className="relative">
          <Input
            id="token"
            type={showToken ? "text" : "password"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={hasExisting ? "••••••••••••" : "Ihr sipgate-Token"}
            autoComplete="new-password"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowToken((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* SMS-ID */}
      <div className="space-y-1.5">
        <Label htmlFor="smsId">SMS-Geräte-ID</Label>
        <Input
          id="smsId"
          value={smsId}
          onChange={(e) => setSmsId(e.target.value)}
          placeholder="s0"
          className="max-w-[120px]"
        />
        <p className="text-xs text-muted-foreground">
          Meist <span className="font-mono">s0</span> — zu finden unter Produkte → SMS in Ihrem sipgate-Konto.
        </p>
      </div>

      {/* Fehler */}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* Speichern / Löschen */}
      <div className="flex items-center gap-3 border-t pt-4">
        <Button onClick={handleSave} disabled={isSaving || !tokenId}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Speichern
        </Button>

        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            Gespeichert
          </span>
        )}

        {hasExisting && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-red-600 hover:text-red-700"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Konfiguration löschen
          </Button>
        )}
      </div>

      {/* Test */}
      {hasExisting && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <p className="text-sm font-medium">Verbindungstest</p>
          <p className="text-xs text-muted-foreground">
            Sendet eine Test-SMS an die angegebene Nummer. Die gespeicherte Konfiguration wird verwendet.
          </p>
          <div className="flex gap-2">
            <Input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+49 151 12345678"
              className="max-w-[220px]"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={isTesting || !testPhone}
            >
              {isTesting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Test-SMS senden
            </Button>
          </div>
          {testResult && (
            <p
              className={`text-sm ${testResult.ok ? "text-green-700" : "text-red-700"}`}
            >
              {testResult.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
