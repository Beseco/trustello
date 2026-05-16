"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, Eye, EyeOff, Trash2 } from "lucide-react";
import {
  saveResellerLetterxpressConfig,
  deleteResellerLetterxpressConfig,
  type LetterxpressConfigData,
} from "@/server/actions/letterxpress-settings";

type Props = {
  initial: LetterxpressConfigData | null;
};

export function LetterxpressForm({ initial }: Props) {
  const [username, setUsername] = useState(initial?.username ?? "");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  const hasExisting = !!initial;

  function handleSave() {
    setError(null);
    setSaved(false);
    startSave(async () => {
      const result = await saveResellerLetterxpressConfig({
        username,
        apiKey: apiKey || undefined,
      });
      if (result.ok) {
        setSaved(true);
        setApiKey("");
        setTimeout(() => setSaved(false), 4000);
      } else {
        setError(result.error);
      }
    });
  }

  function handleDelete() {
    if (!confirm("LetterXpress-Konfiguration wirklich löschen?")) return;
    setError(null);
    startDelete(async () => {
      const result = await deleteResellerLetterxpressConfig();
      if (result.ok) {
        setUsername("");
        setApiKey("");
      } else {
        setError("error" in result ? result.error : "Löschen fehlgeschlagen");
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Benutzername */}
      <div className="space-y-1.5">
        <Label htmlFor="lx-username">Benutzername</Label>
        <Input
          id="lx-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="max.muster@example.de"
          autoComplete="username"
        />
        <p className="text-xs text-muted-foreground">
          Ihr LetterXpress-Login (E-Mail-Adresse oder Benutzername)
        </p>
      </div>

      {/* API-Key */}
      <div className="space-y-1.5">
        <Label htmlFor="lx-apikey">
          API-Key{" "}
          {hasExisting && (
            <span className="font-normal text-muted-foreground">
              (leer lassen um bestehenden zu behalten)
            </span>
          )}
        </Label>
        <div className="relative">
          <Input
            id="lx-apikey"
            type={showApiKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={hasExisting ? "••••••••••••" : "Ihren LetterXpress API-Key einfügen"}
            autoComplete="new-password"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowApiKey((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Zu finden unter{" "}
          <span className="font-mono text-xs">letterxpress.de → Mein Konto → API-Zugang</span>
        </p>
      </div>

      {/* Fehler */}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* Speichern / Löschen */}
      <div className="flex items-center gap-3 border-t pt-4">
        <Button onClick={handleSave} disabled={isSaving || !username}>
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
    </div>
  );
}
