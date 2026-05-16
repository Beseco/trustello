"use server";

import { prisma } from "@/lib/db";
import { requireTenantAdmin } from "@/lib/auth-helpers";
import { getTenantContext } from "@/lib/tenant";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

export async function setCustomerOUs(
  customerId: string,
  ouIds: string[],
): Promise<{ error?: string }> {
  await requireTenantAdmin();
  const { tenantId } = await getTenantContext();

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId },
    select: { id: true },
  });
  if (!customer) return { error: "Kunde nicht gefunden." };

  // Nur OUs dieses Mandanten erlaubt
  const validOUs = await prisma.organisationUnit.findMany({
    where: { tenantId, id: { in: ouIds } },
    select: { id: true },
  });
  const validIds = new Set(validOUs.map((o) => o.id));
  const filteredIds = ouIds.filter((id) => validIds.has(id));

  await prisma.$transaction([
    prisma.customerOnOU.deleteMany({ where: { customerId } }),
    ...(filteredIds.length > 0
      ? [
          prisma.customerOnOU.createMany({
            data: filteredIds.map((ouId) => ({ customerId, ouId })),
          }),
        ]
      : []),
  ]);

  logger.info({ customerId, ouIds: filteredIds }, "Customer OU assignment updated");
  revalidatePath(`/admin/customers/${customerId}`);
  return {};
}
