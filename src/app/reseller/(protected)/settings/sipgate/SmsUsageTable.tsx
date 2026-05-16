"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";
import { setCustomerSmsQuota, type SmsUsageRow } from "@/server/actions/sipgate-settings";
import { useRouter } from "next/navigation";

type Props = {
  rows: SmsUsageRow[];
  currentMonth: number;
};

function StatusBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-slate-400">—</span>;
  if (pct >= 100) return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">🔴 {pct} %</span>;
  if (pct >= 90) return <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">🟠 {pct} %</span>;
  if (pct >= 80) return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">🟡 {pct} %</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">✅ {pct} %</span>;
}

function formatMonth(month: number): string {
  const year = Math.floor(month / 100);
  const m = month % 100;
  return new Date(year, m - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

function QuotaCell({ row }: { row: SmsUsageRow }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.quota?.toString() ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    const quota = value.trim() === "" || value === "0" ? null : parseInt(value, 10);
    if (value.trim() !== "" && value !== "0" && (isNaN(quota!) || quota! < 1)) return;

    startTransition(async () => {
      await setCustomerSmsQuota(row.customerId, quota);
      setEditing(false);
      router.refresh();
    });
  }

  function cancel() {
    setValue(row.quota?.toString() ?? "");
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          min="1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          autoFocus
          className="w-20 rounded border border-slate-300 px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="kein"
        />
        <button onClick={save} disabled={isPending} className="rounded p-0.5 text-green-600 hover:bg-green-50">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button onClick={cancel} className="rounded p-0.5 text-slate-400 hover:bg-slate-100">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group flex items-center gap-1.5 rounded px-1.5 py-0.5 text-sm text-slate-600 hover:bg-slate-100"
    >
      <span>{row.quota ?? <span className="text-slate-400">—</span>}</span>
      <Pencil className="h-3 w-3 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

export function SmsUsageTable({ rows, currentMonth }: Props) {
  const [filter, setFilter] = useState<"month" | "quota">("month");

  const filtered = filter === "quota"
    ? rows.filter((r) => r.quota !== null)
    : rows;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">SMS-Verbrauch</h2>
          <p className="text-sm text-muted-foreground">{formatMonth(currentMonth)}</p>
        </div>
        <div className="flex rounded-lg border p-0.5 text-sm">
          <button
            onClick={() => setFilter("month")}
            className={`rounded-md px-3 py-1 transition-colors ${filter === "month" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}
          >
            Diesen Monat
          </button>
          <button
            onClick={() => setFilter("quota")}
            className={`rounded-md px-3 py-1 transition-colors ${filter === "quota" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}
          >
            Alle mit Kontingent
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center">
          <p className="text-sm text-slate-500">
            {filter === "month"
              ? "In diesem Monat wurden noch keine SMS versendet."
              : "Noch kein Kunde hat ein Kontingent gesetzt."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs font-medium text-slate-500">
                <th className="px-4 py-3">Kunde</th>
                <th className="px-4 py-3">Mandant</th>
                <th className="px-4 py-3 text-right">Versandt</th>
                <th className="px-4 py-3 text-right">Kontingent ✎</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((row) => (
                <tr key={`${row.customerId}-${row.month}`} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{row.customerName}</p>
                    <p className="text-xs text-slate-400">{row.customerEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.tenantName}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-slate-800">
                    {row.count}
                    {row.quota && (
                      <span className="text-slate-400"> / {row.quota}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <QuotaCell row={row} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <StatusBadge pct={row.pct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Kontingent-Wert klicken um es zu bearbeiten. Leer lassen = kein Limit. Bei 80 %, 90 % und 100 % wird automatisch eine Benachrichtigung gesendet. Bei 100 % werden keine weiteren SMS zugestellt.
      </p>
    </div>
  );
}
