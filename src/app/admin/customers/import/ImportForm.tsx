"use client";

import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import { Upload, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { importCustomersFromCSV } from "@/server/actions/customer-import";

type ImportResult = {
  jobId: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  errors: Array<{ row: number; email: string; reason: string }>;
};

export function ImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    if (!f.name.endsWith(".csv") && f.type !== "text/csv") {
      setError("Bitte eine CSV-Datei auswählen");
      return;
    }
    setFile(f);
    setError(null);
    setResult(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function handleImport() {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const text = await file.text();
      const res = await importCustomersFromCSV(text);
      if (res.error) {
        setError(res.error);
      } else {
        setResult(res.result!);
      }
    });
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      {!result ? (
        <>
          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40"
            }`}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">
                CSV-Datei hier ablegen oder <span className="text-primary underline">auswählen</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Trennzeichen: Semikolon (;) · max. 1.000 Zeilen</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>

          {file && (
            <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
              <span className="flex-1 text-sm font-medium">{file.name}</span>
              <span className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </div>
          )}

          {error && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4" />
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleImport}
              disabled={!file || isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              {isPending ? "Importiere..." : "Import starten"}
            </button>
            {file && (
              <button
                onClick={reset}
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
              >
                Zurücksetzen
              </button>
            )}
          </div>

          {/* Format Hint */}
          <div className="rounded-md border bg-muted/40 p-4 text-sm">
            <p className="mb-2 font-medium">Erwartetes CSV-Format (Semikolon-getrennt):</p>
            <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-xs">
{`Anrede;Vorname;Nachname;Email;Mobil;Strasse;PLZ;Ort
Herr;Max;Mustermann;max@example.de;0171234567;Musterstr. 1;80331;München`}
            </pre>
            <p className="mt-2 text-xs text-muted-foreground">
              Pflichtfelder: Vorname, Nachname, Email · Bestehende Kunden werden aktualisiert.
            </p>
          </div>
        </>
      ) : (
        /* Result */
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold">{result.totalRows}</p>
              <p className="text-xs text-muted-foreground">Gesamt</p>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-900 dark:bg-green-950/40">
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">{result.successRows}</p>
              <p className="text-xs text-muted-foreground">Erfolgreich</p>
            </div>
            <div className={`rounded-lg border p-4 text-center ${result.errorRows > 0 ? "border-destructive/30 bg-destructive/5" : "border"}`}>
              <p className={`text-2xl font-bold ${result.errorRows > 0 ? "text-destructive" : ""}`}>{result.errorRows}</p>
              <p className="text-xs text-muted-foreground">Fehler</p>
            </div>
          </div>

          {result.successRows > 0 && (
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              {result.successRows} Kunden erfolgreich importiert / aktualisiert.
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertCircle className="h-4 w-4" />
                Fehlerhafte Zeilen:
              </p>
              <div className="max-h-64 overflow-y-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Zeile</th>
                      <th className="px-3 py-2 text-left font-medium">E-Mail</th>
                      <th className="px-3 py-2 text-left font-medium">Grund</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((err, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-2 font-mono">{err.row}</td>
                        <td className="px-3 py-2">{err.email || "—"}</td>
                        <td className="px-3 py-2 text-destructive">{err.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Link
              href="/admin/customers"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Zur Kundenliste
            </Link>
            <button
              onClick={reset}
              className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
            >
              Weiteren Import starten
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
