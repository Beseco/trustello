"use server";

import { prisma } from "@/lib/db";
import { requireTenantAdmin } from "@/lib/auth-helpers";
import { getTenantContext } from "@/lib/tenant";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import type { TrustLevel } from "@prisma/client";

const VALID_TRUST_LEVELS: TrustLevel[] = [
  "NONE", "EMAIL", "SMS", "PIN_LETTER", "BAYERN_ID_S", "BAYERN_ID_H", "EID",
];

export async function setCustomerTrustLevel(
  customerId: string,
  level: TrustLevel,
): Promise<{ error?: string }> {
  await requireTenantAdmin();
  const { tenantId } = await getTenantContext();

  if (!VALID_TRUST_LEVELS.includes(level)) return { error: "Ungültiges Trust-Level" };

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { tenantId: true },
  });
  if (!customer || customer.tenantId !== tenantId) return { error: "Nicht gefunden" };

  await prisma.$transaction([
    prisma.customer.update({
      where: { id: customerId },
      data: {
        trustLevel: level,
        trustVerifiedAt: level === "NONE" ? null : new Date(),
      },
    }),
    // Record in TrustMethod history (only if not NONE)
    ...(level !== "NONE"
      ? [
          prisma.trustMethod.create({
            data: {
              customerId,
              method: level,
              verifiedAt: new Date(),
              metadata: { source: "manual_admin" },
            },
          }),
        ]
      : []),
  ]);

  logger.info({ customerId, level }, "Customer trust level updated");
  revalidatePath(`/admin/customers/${customerId}`);
  return {};
}
