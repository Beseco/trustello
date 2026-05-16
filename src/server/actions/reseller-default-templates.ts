"use server";

import { prisma } from "@/lib/db";
import { requireReseller } from "@/lib/auth-helpers";
import { z } from "zod";
import { revalidatePath } from "next/cache";

export type ResellerDefaultTemplate = {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  createdAt: Date;
};

const templateSchema = z.object({
  name: z.string().min(1, "Name erforderlich").max(100),
  subject: z.string().max(500).optional(),
  body: z.string().min(1, "Inhalt erforderlich"),
});

export async function getResellerDefaultTemplates(): Promise<ResellerDefaultTemplate[]> {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  return prisma.resellerDefaultTemplate.findMany({
    where: { resellerId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, subject: true, body: true, createdAt: true },
  });
}

export async function createResellerDefaultTemplate(data: {
  name: string;
  subject?: string;
  body: string;
}): Promise<{ id?: string; error?: string }> {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const parsed = templateSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const template = await prisma.resellerDefaultTemplate.create({
    data: {
      resellerId,
      name: parsed.data.name,
      subject: parsed.data.subject ?? null,
      body: parsed.data.body,
    },
  });

  revalidatePath("/reseller/settings/default-templates");
  return { id: template.id };
}

export async function updateResellerDefaultTemplate(
  id: string,
  data: { name: string; subject?: string; body: string },
): Promise<{ error?: string }> {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const template = await prisma.resellerDefaultTemplate.findUnique({ where: { id } });
  if (!template || template.resellerId !== resellerId) return { error: "Vorlage nicht gefunden." };

  const parsed = templateSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  await prisma.resellerDefaultTemplate.update({
    where: { id },
    data: {
      name: parsed.data.name,
      subject: parsed.data.subject ?? null,
      body: parsed.data.body,
    },
  });

  revalidatePath("/reseller/settings/default-templates");
  return {};
}

export async function deleteResellerDefaultTemplate(id: string): Promise<{ error?: string }> {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const template = await prisma.resellerDefaultTemplate.findUnique({ where: { id } });
  if (!template || template.resellerId !== resellerId) return { error: "Vorlage nicht gefunden." };

  await prisma.resellerDefaultTemplate.delete({ where: { id } });

  revalidatePath("/reseller/settings/default-templates");
  return {};
}
