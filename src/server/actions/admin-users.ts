"use server";

import { prisma } from "@/lib/db";
import { requireTenantAdmin } from "@/lib/auth-helpers";
import * as argon2 from "argon2";
import { sendMail } from "@/lib/mail/send";
import { welcomeEmployeeTemplate } from "@/lib/mail/templates/welcome-employee";
import { z } from "zod";
import type { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

const inviteSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().toLowerCase(),
  roles: z.array(z.enum(["TENANT_ADMIN", "USER_MANAGER", "CUSTOMER_MANAGER", "EMPLOYEE"])),
});

export async function inviteUser(formData: {
  firstName: string;
  lastName: string;
  email: string;
  roles: UserRole[];
  ouId?: string;
  ouRole?: "MEMBER" | "ADMIN";
}): Promise<{ error?: string; userId?: string }> {
  const session = await requireTenantAdmin();
  const tenantId = session.user.tenantId!;

  const parsed = inviteSchema.safeParse(formData);
  if (!parsed.success) return { error: "Ungültige Eingaben." };

  const { firstName, lastName, email, roles } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "Diese E-Mail-Adresse ist bereits vergeben." };

  // Plan-Limit: maxUsers prüfen
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { plan: { select: { maxUsers: true } } },
  });
  if (tenant) {
    const currentCount = await prisma.user.count({ where: { tenantId, isActive: true } });
    if (currentCount >= tenant.plan.maxUsers) {
      return {
        error: `Ihr Plan erlaubt maximal ${tenant.plan.maxUsers} Benutzer. Bitte upgraden Sie Ihren Plan oder deaktivieren Sie nicht benötigte Konten.`,
      };
    }
  }

  const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
  const passwordHash = await argon2.hash(tempPassword, { type: argon2.argon2id });

  const user = await prisma.user.create({
    data: {
      tenantId,
      firstName,
      lastName,
      email,
      passwordHash,
      roles: roles.length > 0 ? roles : ["EMPLOYEE"],
    },
  });

  // OU-Zuweisung direkt beim Anlegen
  if (formData.ouId) {
    const ou = await prisma.organisationUnit.findFirst({ where: { id: formData.ouId, tenantId } });
    if (ou) {
      await prisma.userOnOU.create({
        data: { userId: user.id, ouId: formData.ouId, role: formData.ouRole ?? "MEMBER" },
      });
    }
  }

  await sendMail({
    to: email,
    subject: "Sie wurden zu Trustello eingeladen",
    html: welcomeEmployeeTemplate({ name: `${firstName} ${lastName}`, email, tempPassword }),
  });

  logger.info({ email, tenantId, roles }, "User invited");
  revalidatePath("/admin/users");
  return { userId: user.id };
}

export async function toggleUserActive(
  userId: string,
  active: boolean,
): Promise<{ error?: string }> {
  const session = await requireTenantAdmin();
  const tenantId = session.user.tenantId!;

  // Nicht sich selbst deaktivieren
  if (userId === session.user.id) {
    return { error: "Sie können Ihr eigenes Konto nicht deaktivieren." };
  }

  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) return { error: "Benutzer nicht gefunden." };

  await prisma.user.update({ where: { id: userId }, data: { isActive: active } });
  logger.info({ userId, active, by: session.user.id }, "User active status changed");
  revalidatePath("/admin/users");
  return {};
}

export async function updateUserRoles(
  userId: string,
  roles: UserRole[],
): Promise<{ error?: string }> {
  const session = await requireTenantAdmin();
  const tenantId = session.user.tenantId!;

  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) return { error: "Benutzer nicht gefunden." };

  await prisma.user.update({ where: { id: userId }, data: { roles } });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return {};
}

const updateProfileSchema = z.object({
  salutation: z.string().optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(50).optional(),
  position: z.string().max(200).optional(),
});

export async function updateUserProfileAdmin(
  userId: string,
  data: {
    salutation?: string;
    firstName: string;
    lastName: string;
    phone?: string;
    position?: string;
  },
): Promise<{ error?: string }> {
  const session = await requireTenantAdmin();
  const tenantId = session.user.tenantId!;

  const parsed = updateProfileSchema.safeParse(data);
  if (!parsed.success) return { error: "Ungültige Eingaben." };

  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) return { error: "Benutzer nicht gefunden." };

  await prisma.user.update({
    where: { id: userId },
    data: {
      salutation: parsed.data.salutation || null,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone || null,
      position: parsed.data.position || null,
    },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return {};
}

export async function assignUserToOU(
  userId: string,
  ouId: string,
  role: "MEMBER" | "ADMIN",
): Promise<{ error?: string }> {
  const session = await requireTenantAdmin();
  const tenantId = session.user.tenantId!;

  const [user, ou] = await Promise.all([
    prisma.user.findFirst({ where: { id: userId, tenantId } }),
    prisma.organisationUnit.findFirst({ where: { id: ouId, tenantId } }),
  ]);
  if (!user || !ou) return { error: "Benutzer oder Einheit nicht gefunden." };

  await prisma.userOnOU.upsert({
    where: { userId_ouId: { userId, ouId } },
    create: { userId, ouId, role },
    update: { role },
  });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/organisation");
  return {};
}

export async function removeUserFromOU(userId: string, ouId: string): Promise<{ error?: string }> {
  const session = await requireTenantAdmin();
  const tenantId = session.user.tenantId!;

  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) return { error: "Benutzer nicht gefunden." };

  await prisma.userOnOU.deleteMany({ where: { userId, ouId } });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/organisation");
  return {};
}

export async function resetUserPasswordAdmin(
  userId: string,
): Promise<{ error?: string; tempPassword?: string }> {
  const session = await requireTenantAdmin();
  const tenantId = session.user.tenantId!;

  if (userId === session.user.id) return { error: "Eigenes Passwort nicht hierüber zurücksetzen." };

  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) return { error: "Benutzer nicht gefunden." };

  const tempPassword = Math.random().toString(36).slice(-8) + "A1!";
  const passwordHash = await argon2.hash(tempPassword, { type: argon2.argon2id });

  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  logger.info({ userId, by: session.user.id }, "Admin reset user password");
  return { tempPassword };
}

export async function resendInvite(userId: string): Promise<{ error?: string }> {
  const session = await requireTenantAdmin();
  const tenantId = session.user.tenantId!;

  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) return { error: "Benutzer nicht gefunden." };

  const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
  const passwordHash = await argon2.hash(tempPassword, { type: argon2.argon2id });

  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  await sendMail({
    to: user.email,
    subject: "Ihr Trustello-Zugang",
    html: welcomeEmployeeTemplate({
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      tempPassword,
    }),
  });

  logger.info({ userId, by: session.user.id }, "Invite resent");
  return {};
}
