"use server";

import { prisma } from "@/lib/db";
import { requireReseller } from "@/lib/auth-helpers";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const planSchema = z.object({
  name: z.string().min(2, "Mind. 2 Zeichen").max(100),
  monthlyPrice: z.number().min(0, "Preis darf nicht negativ sein"),
  setupFee: z.number().min(0),
  maxUsers: z.number().int().min(1).max(10000),
  storageGB: z.number().int().min(1).max(10000),
  maxFileSizeMB: z.number().int().min(1).max(2048),
  retentionDays: z.number().int().min(1).max(3650),
  hasOutlookAddin: z.boolean(),
  hasBayernID: z.boolean(),
  hasEID: z.boolean(),
  hasAPI: z.boolean(),
  isTrial: z.boolean(),
  trialDays: z.number().int().min(1).max(365).nullable(),
  active: z.boolean(),
});

export type PlanInput = z.infer<typeof planSchema>;
export type PlanResult = { planId?: string; error?: string };

export async function createPlan(data: PlanInput): Promise<PlanResult> {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const parsed = planSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };

  const plan = await prisma.plan.create({
    data: {
      resellerId,
      name: parsed.data.name,
      monthlyPrice: parsed.data.monthlyPrice,
      setupFee: parsed.data.setupFee,
      maxUsers: parsed.data.maxUsers,
      storageGB: parsed.data.storageGB,
      maxFileSizeMB: parsed.data.maxFileSizeMB,
      retentionDays: parsed.data.retentionDays,
      hasOutlookAddin: parsed.data.hasOutlookAddin,
      hasBayernID: parsed.data.hasBayernID,
      hasEID: parsed.data.hasEID,
      hasAPI: parsed.data.hasAPI,
      isTrial: parsed.data.isTrial,
      trialDays: parsed.data.trialDays,
      active: parsed.data.active,
    },
  });

  revalidatePath("/reseller/plans");
  return { planId: plan.id };
}

export async function updatePlan(planId: string, data: PlanInput): Promise<PlanResult> {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const parsed = planSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan || plan.resellerId !== resellerId) return { error: "Plan nicht gefunden" };

  await prisma.plan.update({ where: { id: planId }, data: parsed.data });
  revalidatePath("/reseller/plans");
  return { planId };
}

export async function togglePlanActive(planId: string, active: boolean): Promise<{ error?: string }> {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan || plan.resellerId !== resellerId) return { error: "Plan nicht gefunden" };

  await prisma.plan.update({ where: { id: planId }, data: { active } });
  revalidatePath("/reseller/plans");
  return {};
}
