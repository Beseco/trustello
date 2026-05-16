"use server";

import { prisma } from "@/lib/db";
import { requireTenantAdmin } from "@/lib/auth-helpers";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const settingsSchema = z.object({
  defaultSecurityLevel: z.enum(["LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4"]),
  defaultMinTrustLevel: z.enum(["NONE", "EMAIL", "SMS", "PIN_LETTER", "BAYERN_ID_S", "BAYERN_ID_H", "EID"]),
  allowCustomerReplyDefault: z.boolean(),
  allowSubjectEncryption: z.boolean(),
  allowEmployeeOUCreate: z.boolean(),
  retentionDaysOverride: z.number().int().min(1).max(3650).nullable(),
});

export type UpdateSettingsInput = z.infer<typeof settingsSchema>;

export async function updateTenantSettings(data: UpdateSettingsInput): Promise<{ error?: string }> {
  const session = await requireTenantAdmin();
  const tenantId = session.user.tenantId!;

  const parsed = settingsSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };

  await prisma.tenantSettings.upsert({
    where: { tenantId },
    create: { tenantId, ...parsed.data },
    update: parsed.data,
  });

  revalidatePath("/admin/settings");
  return {};
}
