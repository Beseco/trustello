"use server";

import { prisma } from "@/lib/db";
import { requireTenantAdmin } from "@/lib/auth-helpers";
import { getTenantContext } from "@/lib/tenant";
import { randomBytes, createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "Name erforderlich").max(100),
  scopes: z.array(z.string()).min(1, "Mindestens einen Scope auswählen"),
  expiresAt: z.string().nullable().optional(),
});

export async function createApiKey(data: {
  name: string;
  scopes: string[];
  expiresAt?: string | null;
}): Promise<{ error?: string; plainKey?: string }> {
  await requireTenantAdmin();
  const { tenantId } = await getTenantContext();

  const parsed = createSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };

  const rawKey = `tk_${randomBytes(32).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  await prisma.apiKey.create({
    data: {
      tenantId,
      name: parsed.data.name,
      keyHash,
      scopes: parsed.data.scopes,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    },
  });

  revalidatePath("/admin/api-keys");
  return { plainKey: rawKey };
}

export async function deleteApiKey(keyId: string): Promise<{ error?: string }> {
  await requireTenantAdmin();
  const { tenantId } = await getTenantContext();

  const key = await prisma.apiKey.findUnique({ where: { id: keyId } });
  if (!key || key.tenantId !== tenantId) return { error: "Nicht gefunden" };

  await prisma.apiKey.delete({ where: { id: keyId } });
  revalidatePath("/admin/api-keys");
  return {};
}
