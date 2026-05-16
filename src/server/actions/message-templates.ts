"use server";

import { prisma } from "@/lib/db";
import { requireEmployee } from "@/lib/auth-helpers";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { TemplateScope } from "@prisma/client";

const templateSchema = z.object({
  name: z.string().min(1, "Name erforderlich").max(100),
  subject: z.string().max(500).optional(),
  body: z.string().min(1, "Inhalt erforderlich"),
});

export type TemplateWithScope = {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  scope: TemplateScope;
  ouId: string | null;
  createdByName: string;
  isOwn: boolean;
};

export async function createMessageTemplate(data: {
  name: string;
  subject?: string;
  body: string;
  scope?: TemplateScope;
  ouId?: string;
}): Promise<{ error?: string; id?: string }> {
  const session = await requireEmployee();
  const tenantId = session.user.tenantId!;
  const userId = session.user.id!;

  const parsed = templateSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };

  const scope = data.scope ?? "GLOBAL";

  // OU scope: verify user is OU admin or tenant admin
  if (scope === "OU") {
    if (!data.ouId) return { error: "OU erforderlich für OU-Vorlagen." };
    const roles = (session.user.roles as string[]) ?? [];
    const isTenantAdmin = roles.includes("TENANT_ADMIN");
    if (!isTenantAdmin) {
      const membership = await prisma.userOnOU.findUnique({
        where: { userId_ouId: { userId, ouId: data.ouId } },
      });
      if (!membership || membership.role !== "ADMIN") {
        return { error: "Nur OU-Admins können OU-Vorlagen erstellen." };
      }
    }
  }

  // GLOBAL scope: only tenant admins
  if (scope === "GLOBAL") {
    const roles = (session.user.roles as string[]) ?? [];
    if (!roles.includes("TENANT_ADMIN")) {
      return { error: "Nur Mandanten-Admins können globale Vorlagen erstellen." };
    }
  }

  const template = await prisma.messageTemplate.create({
    data: {
      tenantId,
      createdById: userId,
      scope,
      ouId: scope === "OU" ? data.ouId : null,
      name: parsed.data.name,
      subject: parsed.data.subject || null,
      body: parsed.data.body,
    },
  });

  if (scope === "GLOBAL") revalidatePath("/admin/settings/templates");
  if (scope === "OU" && data.ouId) revalidatePath(`/admin/organisation/${data.ouId}`);
  if (scope === "USER") revalidatePath("/settings/templates");

  return { id: template.id };
}

export async function updateMessageTemplate(
  id: string,
  data: { name: string; subject?: string; body: string },
): Promise<{ error?: string }> {
  const session = await requireEmployee();
  const tenantId = session.user.tenantId!;
  const userId = session.user.id!;

  const parsed = templateSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };

  const existing = await prisma.messageTemplate.findFirst({ where: { id, tenantId } });
  if (!existing) return { error: "Vorlage nicht gefunden." };

  // Permission check
  const roles = (session.user.roles as string[]) ?? [];
  const isTenantAdmin = roles.includes("TENANT_ADMIN");

  if (existing.scope === "USER" && existing.createdById !== userId) {
    return { error: "Keine Berechtigung." };
  }
  if (existing.scope === "GLOBAL" && !isTenantAdmin) {
    return { error: "Nur Mandanten-Admins können globale Vorlagen bearbeiten." };
  }
  if (existing.scope === "OU" && !isTenantAdmin) {
    const membership = await prisma.userOnOU.findUnique({
      where: { userId_ouId: { userId, ouId: existing.ouId! } },
    });
    if (!membership || membership.role !== "ADMIN") {
      return { error: "Nur OU-Admins können OU-Vorlagen bearbeiten." };
    }
  }

  await prisma.messageTemplate.update({
    where: { id },
    data: {
      name: parsed.data.name,
      subject: parsed.data.subject || null,
      body: parsed.data.body,
    },
  });

  if (existing.scope === "GLOBAL") revalidatePath("/admin/settings/templates");
  if (existing.scope === "OU" && existing.ouId) revalidatePath(`/admin/organisation/${existing.ouId}`);
  if (existing.scope === "USER") revalidatePath("/settings/templates");

  return {};
}

export async function deleteMessageTemplate(id: string): Promise<{ error?: string }> {
  const session = await requireEmployee();
  const tenantId = session.user.tenantId!;
  const userId = session.user.id!;

  const existing = await prisma.messageTemplate.findFirst({ where: { id, tenantId } });
  if (!existing) return { error: "Vorlage nicht gefunden." };

  const roles = (session.user.roles as string[]) ?? [];
  const isTenantAdmin = roles.includes("TENANT_ADMIN");

  if (existing.scope === "USER" && existing.createdById !== userId) {
    return { error: "Keine Berechtigung." };
  }
  if (existing.scope === "GLOBAL" && !isTenantAdmin) {
    return { error: "Nur Mandanten-Admins können globale Vorlagen löschen." };
  }
  if (existing.scope === "OU" && !isTenantAdmin) {
    const membership = await prisma.userOnOU.findUnique({
      where: { userId_ouId: { userId, ouId: existing.ouId! } },
    });
    if (!membership || membership.role !== "ADMIN") {
      return { error: "Nur OU-Admins können OU-Vorlagen löschen." };
    }
  }

  await prisma.messageTemplate.delete({ where: { id } });

  if (existing.scope === "GLOBAL") revalidatePath("/admin/settings/templates");
  if (existing.scope === "OU" && existing.ouId) revalidatePath(`/admin/organisation/${existing.ouId}`);
  if (existing.scope === "USER") revalidatePath("/settings/templates");

  return {};
}

/** Returns all templates visible to the current user, grouped by scope. */
export async function getMessageTemplates(): Promise<{
  global: TemplateWithScope[];
  ou: TemplateWithScope[];
  user: TemplateWithScope[];
}> {
  const session = await requireEmployee();
  const tenantId = session.user.tenantId!;
  const userId = session.user.id!;

  // Get user's OU memberships
  const memberships = await prisma.userOnOU.findMany({
    where: { userId },
    select: { ouId: true },
  });
  const ouIds = memberships.map((m) => m.ouId);

  const templates = await prisma.messageTemplate.findMany({
    where: {
      tenantId,
      OR: [
        { scope: "GLOBAL" },
        { scope: "OU", ouId: { in: ouIds } },
        { scope: "USER", createdById: userId },
      ],
    },
    orderBy: { name: "asc" },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
  });

  const toItem = (t: typeof templates[0]): TemplateWithScope => ({
    id: t.id,
    name: t.name,
    subject: t.subject,
    body: t.body,
    scope: t.scope,
    ouId: t.ouId,
    createdByName: t.createdBy ? `${t.createdBy.firstName} ${t.createdBy.lastName}` : "System",
    isOwn: t.createdById === userId,
  });

  return {
    global: templates.filter((t) => t.scope === "GLOBAL").map(toItem),
    ou: templates.filter((t) => t.scope === "OU").map(toItem),
    user: templates.filter((t) => t.scope === "USER").map(toItem),
  };
}

/** Returns only templates of a specific scope — used by admin/OU pages. */
export async function getTemplatesByScope(
  scope: TemplateScope,
  ouId?: string,
): Promise<TemplateWithScope[]> {
  const session = await requireEmployee();
  const tenantId = session.user.tenantId!;
  const userId = session.user.id!;

  const templates = await prisma.messageTemplate.findMany({
    where: {
      tenantId,
      scope,
      ...(scope === "OU" && ouId ? { ouId } : {}),
      ...(scope === "USER" ? { createdById: userId } : {}),
    },
    orderBy: { name: "asc" },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
  });

  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    subject: t.subject,
    body: t.body,
    scope: t.scope,
    ouId: t.ouId,
    createdByName: t.createdBy ? `${t.createdBy.firstName} ${t.createdBy.lastName}` : "System",
    isOwn: t.createdById === userId,
  }));
}
