"use server";

import { prisma } from "@/lib/db";
import { requireTenantAdmin } from "@/lib/auth-helpers";
import { getTenantContext } from "@/lib/tenant";
import * as argon2 from "argon2";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { z } from "zod";

const passwordSchema = z
  .string()
  .min(10, "Mind. 10 Zeichen")
  .regex(/[A-Z]/, "Mind. ein Großbuchstabe")
  .regex(/[0-9]/, "Mind. eine Ziffer")
  .regex(/[^A-Za-z0-9]/, "Mind. ein Sonderzeichen");

export async function setCustomerPassword(
  customerId: string,
  password: string,
): Promise<{ error?: string }> {
  await requireTenantAdmin();
  const { tenantId } = await getTenantContext();

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { tenantId: true },
  });
  if (!customer || customer.tenantId !== tenantId) return { error: "Nicht gefunden" };

  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültiges Passwort" };

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  await prisma.customer.update({
    where: { id: customerId },
    data: { passwordHash, hasAccount: true },
  });

  logger.info({ customerId }, "Customer account password set");
  revalidatePath(`/admin/customers/${customerId}`);
  return {};
}

export async function disableCustomerAccount(
  customerId: string,
): Promise<{ error?: string }> {
  await requireTenantAdmin();
  const { tenantId } = await getTenantContext();

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { tenantId: true },
  });
  if (!customer || customer.tenantId !== tenantId) return { error: "Nicht gefunden" };

  await prisma.customer.update({
    where: { id: customerId },
    data: { passwordHash: null, hasAccount: false },
  });

  logger.info({ customerId }, "Customer account disabled");
  revalidatePath(`/admin/customers/${customerId}`);
  return {};
}
