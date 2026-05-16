"use client";

import { useTransition } from "react";
import { updateTenantPlan } from "@/server/actions/reseller-tenants";
import { toast } from "sonner";

type Plan = { id: string; name: string; monthlyPrice: string };

export function PlanSelect({
  tenantId,
  currentPlanId,
  plans,
}: {
  tenantId: string;
  currentPlanId: string;
  plans: Plan[];
}) {
  const [pending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const planId = e.target.value;
    startTransition(async () => {
      const result = await updateTenantPlan(tenantId, planId);
      if (result.error) toast.error(result.error);
      else toast.success("Plan aktualisiert");
    });
  }

  return (
    <select
      defaultValue={currentPlanId}
      onChange={onChange}
      disabled={pending}
      className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm disabled:opacity-50"
    >
      {plans.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} ({Number(p.monthlyPrice) === 0 ? "kostenlos" : `${p.monthlyPrice} €/Mo`})
        </option>
      ))}
    </select>
  );
}
