"use server";

import { prisma } from "@/lib/db";
import { requireReseller } from "@/lib/auth-helpers";
import { createTenantKeyMaterial } from "@/lib/crypto/envelope";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import * as argon2 from "argon2";
import { sendMail } from "@/lib/mail/send";
import { welcomeEmployeeTemplate } from "@/lib/mail/templates/welcome-employee";
import { logger } from "@/lib/logger";

const createTenantSchema = z.object({
  name: z.string().min(2, "Mind. 2 Zeichen").max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Nur Kleinbuchstaben, Ziffern und Bindestriche"),
  billingEmail: z.string().email("Ungültige E-Mail"),
  planId: z.string().min(1, "Bitte Plan wählen"),
  autoLoginDomains: z.string().optional(),
  status: z.enum(["TRIAL", "ACTIVE"]),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export async function createTenant(data: CreateTenantInput): Promise<{ error?: string }> {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const parsed = createTenantSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }

  const { name, slug, billingEmail, planId, autoLoginDomains, status } = parsed.data;

  // Plan muss dem Reseller gehören
  const plan = await prisma.plan.findFirst({ where: { id: planId, resellerId } });
  if (!plan) return { error: "Plan nicht gefunden." };

  const slugExists = await prisma.tenant.findUnique({ where: { slug } });
  if (slugExists) return { error: "Dieser Slug ist bereits vergeben." };

  const domains = autoLoginDomains
    ? autoLoginDomains
        .split(/[,\s]+/)
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean)
    : [];

  const keyMaterial = createTenantKeyMaterial();

  const [tenant, defaultTemplates] = await Promise.all([
    prisma.tenant.create({
      data: {
        resellerId,
        planId,
        name,
        slug,
        billingEmail,
        billingAddress: {},
        autoLoginDomains: domains,
        status,
        trialEndsAt: status === "TRIAL" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
        tenantMasterKey: keyMaterial.tenantMasterKey as unknown as Uint8Array<ArrayBuffer>,
        tmkIv: keyMaterial.tmkIv as unknown as Uint8Array<ArrayBuffer>,
        tmkAuthTag: keyMaterial.tmkAuthTag as unknown as Uint8Array<ArrayBuffer>,
        settings: {
          create: {},
        },
      },
    }),
    prisma.resellerDefaultTemplate.findMany({ where: { resellerId } }),
  ]);

  if (defaultTemplates.length > 0) {
    await prisma.messageTemplate.createMany({
      data: defaultTemplates.map((t) => ({
        tenantId: tenant.id,
        name: t.name,
        subject: t.subject,
        body: t.body,
        scope: "GLOBAL" as const,
      })),
    });
  }

  revalidatePath("/reseller");
  revalidatePath("/reseller/tenants");
  return {};
}

const VALID_STATUSES = ["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"] as const;
type TenantStatus = (typeof VALID_STATUSES)[number];

export async function updateTenantStatus(
  tenantId: string,
  status: TenantStatus,
): Promise<{ error?: string }> {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant || tenant.resellerId !== resellerId) return { error: "Mandant nicht gefunden" };
  if (!VALID_STATUSES.includes(status)) return { error: "Ungültiger Status" };

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      status,
      trialEndsAt: status === "TRIAL" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : undefined,
    },
  });

  revalidatePath("/reseller/tenants");
  revalidatePath(`/reseller/tenants/${tenantId}`);
  return {};
}

export async function updateTenantPlan(
  tenantId: string,
  planId: string,
): Promise<{ error?: string }> {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const [tenant, plan] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, resellerId: true } }),
    prisma.plan.findUnique({ where: { id: planId }, select: { id: true, resellerId: true } }),
  ]);

  if (!tenant || tenant.resellerId !== resellerId) return { error: "Mandant nicht gefunden." };
  if (!plan || plan.resellerId !== resellerId) return { error: "Plan nicht gefunden." };

  await prisma.tenant.update({ where: { id: tenantId }, data: { planId } });

  revalidatePath("/reseller/tenants");
  revalidatePath(`/reseller/tenants/${tenantId}`);
  return {};
}

export async function resellerResetAdminPassword(
  tenantId: string,
  userId: string,
): Promise<{ error?: string }> {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, resellerId } });
  if (!tenant) return { error: "Mandant nicht gefunden." };

  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) return { error: "Benutzer nicht gefunden." };

  const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
  const passwordHash = await argon2.hash(tempPassword, { type: argon2.argon2id });
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  await sendMail(
    {
      to: user.email,
      subject: "Ihr Trustello-Zugang",
      html: welcomeEmployeeTemplate({
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        tempPassword,
      }),
    },
    undefined,
    resellerId,
  );

  logger.info({ userId, tenantId, by: session.user.id }, "Reseller reset admin password");
  return {};
}

const createTenantAdminSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().toLowerCase(),
});

export async function resellerCreateTenantAdmin(
  tenantId: string,
  data: { firstName: string; lastName: string; email: string },
): Promise<{ error?: string }> {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, resellerId },
    include: { plan: { select: { maxUsers: true } } },
  });
  if (!tenant) return { error: "Mandant nicht gefunden." };

  const parsed = createTenantAdminSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };

  const { firstName, lastName, email } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "Diese E-Mail-Adresse ist bereits vergeben." };

  const currentCount = await prisma.user.count({ where: { tenantId, isActive: true } });
  if (currentCount >= tenant.plan.maxUsers) {
    return { error: `Plan-Limit erreicht (max. ${tenant.plan.maxUsers} Benutzer).` };
  }

  const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
  const passwordHash = await argon2.hash(tempPassword, { type: argon2.argon2id });

  const user = await prisma.user.create({
    data: { tenantId, firstName, lastName, email, passwordHash, roles: ["TENANT_ADMIN"] },
  });

  await sendMail(
    {
      to: email,
      subject: "Sie wurden zu Trustello eingeladen",
      html: welcomeEmployeeTemplate({ name: `${firstName} ${lastName}`, email, tempPassword }),
    },
    undefined,
    resellerId,
  );

  logger.info({ userId: user.id, tenantId, by: session.user.id }, "Reseller created tenant admin");

  revalidatePath(`/reseller/tenants/${tenantId}`);
  return {};
}
