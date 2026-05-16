"use client";

import { useTransition } from "react";
import { setCustomerTrustLevel } from "@/server/actions/customer-trust";
import { toast } from "sonner";
import type { TrustLevel } from "@prisma/client";

const TRUST_OPTIONS: { value: TrustLevel; label: string }[] = [
  { value: "NONE", label: "Keine Verifizierung" },
  { value: "EMAIL", label: "E-Mail verifiziert" },
  { value: "SMS", label: "SMS verifiziert" },
  { value: "PIN_LETTER", label: "PIN-Brief" },
  { value: "BAYERN_ID_S", label: "BayernID (Substantiell)" },
  { value: "BAYERN_ID_H", label: "BayernID (Hoch)" },
  { value: "EID", label: "eID" },
];

type Props = { customerId: string; current: TrustLevel };

export function TrustLevelSelect({ customerId, current }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const level = e.target.value as TrustLevel;
    startTransition(async () => {
      const result = await setCustomerTrustLevel(customerId, level);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Vertrauensstufe aktualisiert");
      }
    });
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      disabled={isPending}
      className="rounded-md border bg-background px-2 py-1 text-sm disabled:opacity-50"
    >
      {TRUST_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
