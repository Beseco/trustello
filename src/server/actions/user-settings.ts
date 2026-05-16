"use server";

import { prisma } from "@/lib/db";
import { requireEmployee } from "@/lib/auth-helpers";
import * as argon2 from "argon2";
import { logger } from "@/lib/logger";
import { z } from "zod";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Aktuelles Passwort erforderlich"),
  newPassword: z
    .string()
    .min(10, "Mind. 10 Zeichen")
    .regex(/[A-Z]/, "Mind. ein Großbuchstabe")
    .regex(/[0-9]/, "Mind. eine Ziffer")
    .regex(/[^A-Za-z0-9]/, "Mind. ein Sonderzeichen"),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwörter stimmen nicht überein",
  path: ["confirmPassword"],
});

export type ChangePasswordResult = { error?: string; fieldErrors?: Record<string, string> };

export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ChangePasswordResult> {
  const session = await requireEmployee();
  const userId = session.user.id!;

  const parsed = changePasswordSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]?.toString() ?? "form";
      fieldErrors[field] = issue.message;
    }
    return { fieldErrors };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash) return { error: "Benutzer nicht gefunden" };

  const currentValid = await argon2.verify(user.passwordHash, parsed.data.currentPassword);
  if (!currentValid) return { fieldErrors: { currentPassword: "Aktuelles Passwort ist falsch" } };

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return { fieldErrors: { newPassword: "Neues Passwort muss sich vom aktuellen unterscheiden" } };
  }

  const newHash = await argon2.hash(parsed.data.newPassword, { type: argon2.argon2id });
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });

  logger.info({ userId }, "Password changed");
  return {};
}
