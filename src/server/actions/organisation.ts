"use server";

import { prisma } from "@/lib/db";
import { requireEmployee, requireTenantAdmin } from "@/lib/auth-helpers";
import { z } from "zod";
import { revalidatePath } from "next/cache";

export type MyOU = { id: string; name: string };

export async function getMyOUs(): Promise<MyOU[]> {
  const session = await requireEmployee();
  const userId = session.user.id!;
  const memberships = await prisma.userOnOU.findMany({
    where: { userId },
    select: { ou: { select: { id: true, name: true } } },
    orderBy: { ou: { name: "asc" } },
  });
  return memberships.map((m) => m.ou);
}

const ouSchema = z.object({
  name: z.string().min(2, "Mind. 2 Zeichen").max(100),
  description: z.string().max(500).optional(),
  parentId: z.string().optional(),
});

export type CreateOUResult = { ouId?: string; error?: string };

export async function createOU(data: {
  name: string;
  description?: string;
  parentId?: string;
}): Promise<CreateOUResult> {
  const session = await requireTenantAdmin();
  const tenantId = session.user.tenantId!;

  const parsed = ouSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };

  // Übergeordnete Einheit muss zum selben Mandanten gehören
  if (parsed.data.parentId) {
    const parent = await prisma.organisationUnit.findUnique({ where: { id: parsed.data.parentId } });
    if (!parent || parent.tenantId !== tenantId) return { error: "Übergeordnete Einheit nicht gefunden" };
  }

  const ou = await prisma.organisationUnit.create({
    data: {
      tenantId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      parentId: parsed.data.parentId || null,
    },
  });

  revalidatePath("/admin/organisation");
  return { ouId: ou.id };
}

export async function updateOU(
  ouId: string,
  data: { name: string; description?: string; parentId?: string },
): Promise<{ error?: string }> {
  const session = await requireTenantAdmin();
  const tenantId = session.user.tenantId!;

  const parsed = ouSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };

  const ou = await prisma.organisationUnit.findFirst({ where: { id: ouId, tenantId } });
  if (!ou) return { error: "Einheit nicht gefunden" };

  // Sicherstellen dass parentId nicht auf sich selbst oder eigene Kinder zeigt
  if (parsed.data.parentId === ouId) return { error: "Eine Einheit kann nicht ihre eigene übergeordnete Einheit sein." };

  await prisma.organisationUnit.update({
    where: { id: ouId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      parentId: parsed.data.parentId || null,
    },
  });

  revalidatePath("/admin/organisation");
  revalidatePath(`/admin/organisation/${ouId}`);
  return {};
}

export async function deleteOU(ouId: string): Promise<{ error?: string }> {
  const session = await requireTenantAdmin();
  const tenantId = session.user.tenantId!;

  const ou = await prisma.organisationUnit.findUnique({
    where: { id: ouId },
    include: { _count: { select: { children: true, members: true } } },
  });

  if (!ou || ou.tenantId !== tenantId) return { error: "Einheit nicht gefunden" };
  if (ou._count.children > 0) return { error: "Einheit hat noch Untereinheiten" };
  if (ou._count.members > 0) return { error: "Einheit hat noch Mitglieder" };

  await prisma.organisationUnit.delete({ where: { id: ouId } });
  revalidatePath("/admin/organisation");
  return {};
}
