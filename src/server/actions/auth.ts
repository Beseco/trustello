"use server";

import * as argon2 from "argon2";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail/send";
import { welcomeEmployeeTemplate } from "@/lib/mail/templates/welcome-employee";
import { registerEmployeeSchema } from "@/lib/validation/auth";
import { logger } from "@/lib/logger";

export type RegisterEmployeeResult = {
  error?: string;
};

export async function registerEmployee(data: unknown): Promise<RegisterEmployeeResult> {
  const parsed = registerEmployeeSchema.safeParse(data);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { error: firstIssue?.message ?? "Ungültige Eingabe" };
  }

  const { salutation, firstName, lastName, email, password } = parsed.data;

  const domain = email.split("@")[1];
  if (!domain) return { error: "Ungültige E-Mail-Adresse" };

  const tenant = await prisma.tenant.findFirst({
    where: { autoLoginDomains: { has: domain } },
  });

  if (!tenant) {
    return {
      error: "Diese Domain ist nicht für die Selbstregistrierung freigeschaltet",
    };
  }

  if (!["ACTIVE", "TRIAL"].includes(tenant.status)) {
    return { error: "Dieser Mandant ist nicht aktiv" };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Diese E-Mail-Adresse ist bereits registriert" };
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      salutation,
      firstName,
      lastName,
      email,
      passwordHash,
      roles: ["EMPLOYEE"],
    },
  });

  logger.info({ userId: user.id, tenantId: tenant.id }, "New employee registered");

  try {
    await sendMail({
      to: email,
      subject: "Willkommen bei Trustello",
      html: welcomeEmployeeTemplate(`${firstName} ${lastName}`),
    });
  } catch {
    logger.warn({ userId: user.id }, "Welcome mail failed");
  }

  return {};
}
