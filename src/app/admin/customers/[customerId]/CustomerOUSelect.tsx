"use client";

import { useState, useTransition } from "react";
import { setCustomerOUs } from "@/server/actions/customer-ou";
import { Building2 } from "lucide-react";

type OU = { id: string; name: string };

type Props = {
  customerId: string;
  allOUs: OU[];
  assignedOUIds: string[];
};

export function CustomerOUSelect({ customerId, allOUs, assignedOUIds }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(assignedOUIds));
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setSaved(false);
  }

  function save() {
    startTransition(async () => {
      await setCustomerOUs(customerId, [...selected]);
      setSaved(true);
    });
  }

  if (allOUs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Keine Organisationseinheiten vorhanden.</p>
    );
  }

  return (
    <div className="space-y-2">
      {allOUs.map((ou) => (
        <label key={ou.id} className="flex items-center gap-2 cursor-pointer select-none text-sm">
          <input
            type="checkbox"
            checked={selected.has(ou.id)}
            onChange={() => toggle(ou.id)}
            disabled={pending}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {ou.name}
        </label>
      ))}
      <button
        onClick={save}
        disabled={pending}
        className="mt-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {saved ? "Gespeichert ✓" : "Speichern"}
      </button>
    </div>
  );
}
