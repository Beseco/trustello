"use server";

import { prisma } from "@/lib/db";
import { requireEmployee } from "@/lib/auth-helpers";
import { getTenantContext } from "@/lib/tenant";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({ content: z.string().min(1).max(2000) });

export async function addCustomerNote(
  customerId: string,
  content: string,
): Promise<{ error?: string }> {
  const session = await requireEmployee();
  const { tenantId } = await getTenantContext();

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { tenantId: true },
  });
  if (!customer || customer.tenantId !== tenantId) return { error: "Nicht gefunden" };

  const parsed = schema.safeParse({ content });
  if (!parsed.success) return { error: "Inhalt ungültig" };

  await prisma.customerNote.create({
    data: { customerId, authorId: session.user.id!, content: parsed.data.content },
  });

  revalidatePath(`/admin/customers/${customerId}`);
  return {};
}

export async function deleteCustomerNote(
  noteId: string,
): Promise<{ error?: string }> {
  const session = await requireEmployee();
  const { tenantId } = await getTenantContext();

  const note = await prisma.customerNote.findUnique({
    where: { id: noteId },
    include: { customer: { select: { tenantId: true } } },
  });

  if (!note || note.customer.tenantId !== tenantId) return { error: "Nicht gefunden" };

  const roles = (session.user as { roles?: string[] }).roles ?? [];
  const isAdmin = roles.includes("TENANT_ADMIN") || roles.includes("USER_MANAGER");
  if (!isAdmin && note.authorId !== session.user.id) return { error: "Keine Berechtigung" };

  await prisma.customerNote.delete({ where: { id: noteId } });
  revalidatePath(`/admin/customers/${note.customerId}`);
  return {};
}
