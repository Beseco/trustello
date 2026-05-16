"use client";

import { useState, useTransition } from "react";
import { Plus, Copy, Check, Eye, EyeOff } from "lucide-react";
import { createApiKey } from "@/server/actions/api-keys";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AVAILABLE_SCOPES = [
  { value: "messages:read", label: "Nachrichten lesen" },
  { value: "messages:write", label: "Nachrichten senden" },
  { value: "customers:read", label: "Kunden lesen" },
  { value: "customers:write", label: "Kunden bearbeiten" },
];

export function CreateApiKeyDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [plainKey, setPlainKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggleScope(scope: string) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createApiKey({
        name: name.trim(),
        scopes,
        expiresAt: expiresAt || null,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setPlainKey(result.plainKey!);
      }
    });
  }

  function copyKey() {
    if (!plainKey) return;
    navigator.clipboard.writeText(plainKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose() {
    setOpen(false);
    setName("");
    setScopes([]);
    setExpiresAt("");
    setError(null);
    setPlainKey(null);
    setCopied(false);
    setShown(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger
        render={
          <button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Neuer API-Key
          </button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>API-Key erstellen</DialogTitle>
        </DialogHeader>

        {plainKey ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Der API-Key wird nur einmal angezeigt. Kopieren Sie ihn jetzt.
            </p>
            <div className="flex items-center gap-2 rounded-md border bg-muted p-3">
              <code className="flex-1 break-all font-mono text-xs">
                {shown ? plainKey : "•".repeat(Math.min(plainKey.length, 40))}
              </code>
              <button onClick={() => setShown((v) => !v)} className="text-muted-foreground hover:text-foreground">
                {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button onClick={copyKey} className="text-muted-foreground hover:text-foreground">
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <button
              onClick={handleClose}
              className="w-full rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Schließen
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="key-name">Name *</Label>
              <Input
                id="key-name"
                placeholder="z.B. ERP-Integration"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Berechtigungen *</Label>
              <div className="mt-2 space-y-2">
                {AVAILABLE_SCOPES.map((scope) => (
                  <label key={scope.value} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={scopes.includes(scope.value)}
                      onChange={() => toggleScope(scope.value)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <span>{scope.label}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">{scope.value}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="expires-at">Ablaufdatum (optional)</Label>
              <Input
                id="expires-at"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="mt-1 max-w-[200px]"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={handleClose}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Abbrechen
              </button>
              <button
                onClick={handleCreate}
                disabled={isPending || !name.trim() || scopes.length === 0}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Erstellen
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
