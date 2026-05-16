"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Trash2, AlertTriangle } from "lucide-react";
import { exportCustomerData, hardDeleteCustomer } from "@/server/actions/gdpr";
import { toast } from "sonner";

type Props = {
  customerId: string;
  customerName: string;
};

export function GdprCard({ customerId, customerName }: Props) {
  const router = useRouter();
  const [exportPending, startExport] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  // ── Datenexport ─────────────────────────────────────────────────────────────
  function handleExport() {
    startExport(async () => {
      const result = await exportCustomerData(customerId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const json = JSON.stringify(result.data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dsgvo-export-${customerId}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Daten exportiert");
    });
  }

  // ── Hard-Delete ─────────────────────────────────────────────────────────────
  function handleDelete() {
    if (confirmName.trim() !== customerName.trim()) {
      toast.error("Name stimmt nicht überein");
      return;
    }
    startDelete(async () => {
      const result = await hardDeleteCustomer(customerId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Kundendaten wurden gelöscht und anonymisiert");
      router.push("/admin/customers");
    });
  }

  return (
    <div className="space-y-4">
      {/* Export */}
      <div>
        <p className="text-sm text-muted-foreground mb-2">
          Exportiert alle personenbezogenen Daten als JSON (Art. 20 DSGVO).
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exportPending}
        >
          {exportPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Daten exportieren (JSON)
        </Button>
      </div>

      <div className="border-t pt-4">
        {/* Löschung */}
        {!confirmOpen ? (
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Löscht alle personenbezogenen Daten und Nachrichten unwiderruflich (Art. 17 DSGVO).
            </p>
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Daten löschen
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-destructive">Unwiderrufliche Löschung</p>
                <p className="text-muted-foreground mt-1">
                  Alle Nachrichten, Anhänge, Notizen und Kontodaten werden
                  gelöscht. Der Name und die E-Mail werden anonymisiert.
                  Diese Aktion kann nicht rückgängig gemacht werden.
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">
                Zur Bestätigung den vollständigen Namen eingeben:{" "}
                <span className="font-mono font-medium text-foreground">{customerName}</span>
              </label>
              <input
                type="text"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={customerName}
                className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-destructive/30"
                autoComplete="off"
              />
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={deletePending || confirmName.trim() !== customerName.trim()}
                onClick={handleDelete}
              >
                {deletePending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Unwiderruflich löschen
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setConfirmOpen(false); setConfirmName(""); }}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
