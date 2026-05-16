"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { updateTenantStatus } from "@/server/actions/reseller-tenants";
import { toast } from "sonner";
import type { TenantStatus } from "@prisma/client";

const STATUS_LABELS: Record<TenantStatus, string> = {
  TRIAL: "Trial",
  ACTIVE: "Aktiv",
  SUSPENDED: "Gesperrt",
  CANCELLED: "Gekündigt",
};

export function TenantStatusSelect({
  tenantId,
  currentStatus,
}: {
  tenantId: string;
  currentStatus: TenantStatus;
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as TenantStatus;
    startTransition(async () => {
      const result = await updateTenantStatus(tenantId, newStatus);
      if (result.error) toast.error(result.error);
      else toast.success(`Status geändert: ${STATUS_LABELS[newStatus]}`);
    });
  }

  return (
    <div className="flex items-center gap-1">
      {isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      <select
        value={currentStatus}
        onChange={handleChange}
        disabled={isPending}
        className="rounded border border-input bg-background px-2 py-0.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
      >
        {(Object.keys(STATUS_LABELS) as TenantStatus[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  );
}
