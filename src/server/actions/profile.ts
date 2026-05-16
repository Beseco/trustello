"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/auth-helpers";
import { resolveSignature } from "@/lib/signature";

const updateProfileSchema = z.object({
  firstName: z.string().min(1, "Pflichtfeld").max(100),
  lastName: z.string().min(1, "Pflichtfeld").max(100),
  phone: z.string().max(50).optional().nullable(),
  position: z.string().max(100).optional().nullable(),
});

export type UpdateProfileResult = { error?: string; ok?: true };

export async function updateProfile(data: unknown): Promise<UpdateProfileResult> {
  const session = await auth();
  if (!session?.user?.id || session.user.userType !== "employee") {
    return { error: "Nicht autorisiert" };
  }

  const parsed = updateProfileSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { firstName, lastName, phone, position } = parsed.data;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { firstName, lastName, phone: phone ?? null, position: position ?? null },
  });

  return { ok: true };
}

const signatureTemplateSchema = z.object({
  signatureTemplate: z.string().max(2000).nullable(),
});

export type UpdateSignatureResult = { error?: string; ok?: true };

export async function updateSignatureTemplate(data: unknown): Promise<UpdateSignatureResult> {
  const session = await requireTenantAdmin();
  const tenantId = session.user.tenantId!;

  const parsed = signatureTemplateSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  await prisma.tenantSettings.upsert({
    where: { tenantId },
    create: { tenantId, signatureTemplate: parsed.data.signatureTemplate },
    update: { signatureTemplate: parsed.data.signatureTemplate },
  });

  return { ok: true };
}

/** Gibt die aufgelöste Signatur des aktuell eingeloggten Users zurück */
export async function getMySignature(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.userType !== "employee") return null;

  const tenantId = session.user.tenantId;
  if (!tenantId) return null;

  const [user, settings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { firstName: true, lastName: true, email: true, phone: true, position: true },
    }),
    prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { signatureTemplate: true },
    }),
  ]);

  if (!user || !settings?.signatureTemplate) return null;

  return resolveSignature(settings.signatureTemplate, user);
}
