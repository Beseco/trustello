"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { updateSignatureTemplate } from "@/server/actions/profile";

const PLACEHOLDERS = [
  { key: "{{vorname}}", label: "Vorname" },
  { key: "{{nachname}}", label: "Nachname" },
  { key: "{{name}}", label: "Vor- und Nachname" },
  { key: "{{email}}", label: "E-Mail" },
  { key: "{{telefon}}", label: "Telefon" },
  { key: "{{position}}", label: "Position" },
];

type Props = { defaultTemplate: string | null };

export function SignatureForm({ defaultTemplate }: Props) {
  const [template, setTemplate] = useState(defaultTemplate ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function insertPlaceholder(key: string) {
    setTemplate((prev) => prev + key);
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateSignatureTemplate({ signatureTemplate: template || null });
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    });
  }

  const preview = template
    ? template
        .replace(/\{\{vorname\}\}/gi, "Maria")
        .replace(/\{\{nachname\}\}/gi, "Müller")
        .replace(/\{\{name\}\}/gi, "Maria Müller")
        .replace(/\{\{email\}\}/gi, "m.mueller@stadt-beispiel.de")
        .replace(/\{\{telefon\}\}/gi, "+49 8161 12345")
        .replace(/\{\{position\}\}/gi, "Sachbearbeiterin Baurecht")
    : null;

  return (
    <div className="space-y-4">
      {/* Platzhalter-Chips */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Verfügbare Platzhalter
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => insertPlaceholder(p.key)}
              className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-xs text-blue-700 hover:bg-blue-100 transition-colors"
            >
              {p.key}
              <span className="ml-1 font-sans text-blue-500">→ {p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Template Textarea */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Vorlage</p>
        <textarea
          value={template}
          onChange={(e) => { setTemplate(e.target.value); setSaved(false); }}
          rows={6}
          placeholder={"Mit freundlichen Grüßen\n{{name}}\n{{position}}\n{{email}} · {{telefon}}"}
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">
          Markdown-Formatierung wird unterstützt (z. B. **fett**, *kursiv*).
        </p>
      </div>

      {/* Vorschau */}
      {preview && (
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Vorschau (Beispieldaten)
          </p>
          <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">{preview}</pre>
        </div>
      )}

      {error && (
        <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
      )}
      {saved && <p className="text-sm text-green-600">Signatur gespeichert ✓</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Speichern
        </button>
      </div>
    </div>
  );
}
