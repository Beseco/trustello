"use server";

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { requireTenantAdmin } from "@/lib/auth-helpers";
import { getTenantContext } from "@/lib/tenant";

export type ScimStatus = {
  hasToken: boolean;
  lastUsedAt: Date | null;
  createdAt: Date | null;
};

export async function getScimStatus(): Promise<ScimStatus> {
  await requireTenantAdmin();
  const { tenantId } = await getTenantContext();
  const token = await prisma.scimToken.findUnique({
    where: { tenantId },
    select: { lastUsedAt: true, createdAt: true },
  });
  return {
    hasToken: token !== null,
    lastUsedAt: token?.lastUsedAt ?? null,
    createdAt: token?.createdAt ?? null,
  };
}

export type GenerateScimTokenResult = {
  token: string; // Nur einmalig angezeigt — wird nicht in DB gespeichert
};

export async function generateScimToken(): Promise<GenerateScimTokenResult> {
  await requireTenantAdmin();
  const { tenantId } = await getTenantContext();

  const rawToken = `scim_${randomBytes(32).toString("hex")}`;
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  await prisma.scimToken.upsert({
    where: { tenantId },
    update: { tokenHash, lastUsedAt: null },
    create: { tenantId, tokenHash },
  });

  return { token: rawToken };
}

export async function deleteScimToken(): Promise<void> {
  await requireTenantAdmin();
  const { tenantId } = await getTenantContext();
  await prisma.scimToken.deleteMany({ where: { tenantId } });
}
