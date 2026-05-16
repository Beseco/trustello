"use server";

import { prisma } from "@/lib/db";
import { requireReseller } from "@/lib/auth-helpers";
import { encryptApiKey, decryptApiKey, getLetterxpressStatus } from "@/lib/letter/letterxpress";
import { logger } from "@/lib/logger";
import { z } from "zod";

const schema = z.object({
  username: z.string().min(1, "Benutzername ist erforderlich"),
  apiKey: z.string().optional(),
});

export type LetterxpressFormValues = z.infer<typeof schema>;
export type LetterxpressResult = { ok: true } | { ok: false; error: string };

export type LetterxpressConfigData = {
  username: string;
  hasApiKey: boolean;
};

export async function getResellerLetterxpressConfig(): Promise<LetterxpressConfigData | null> {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const config = await prisma.letterxpressConfig.findUnique({ where: { resellerId } });
  if (!config) return null;

  return { username: config.username, hasApiKey: true };
}

export async function saveResellerLetterxpressConfig(
  values: LetterxpressFormValues,
): Promise<LetterxpressResult> {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { username, apiKey } = parsed.data;
  const existing = await prisma.letterxpressConfig.findUnique({ where: { resellerId } });

  if (!existing && !apiKey) {
    return { ok: false, error: "API-Key ist beim ersten Speichern erforderlich" };
  }

  if (apiKey) {
    const encrypted = encryptApiKey(apiKey);
    await prisma.letterxpressConfig.upsert({
      where: { resellerId },
      create: {
        resellerId,
        username,
        apiKeyEnc: encrypted.tokenEnc,
        apiKeyIv: encrypted.tokenIv,
        apiKeyTag: encrypted.tokenTag,
      },
      update: {
        username,
        apiKeyEnc: encrypted.tokenEnc,
        apiKeyIv: encrypted.tokenIv,
        apiKeyTag: encrypted.tokenTag,
      },
    });
  } else {
    await prisma.letterxpressConfig.update({
      where: { resellerId },
      data: { username },
    });
  }

  logger.info({ resellerId }, "Reseller LetterXpress config saved");
  return { ok: true };
}

export async function deleteResellerLetterxpressConfig(): Promise<LetterxpressResult> {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  await prisma.letterxpressConfig.deleteMany({ where: { resellerId } });
  logger.info({ resellerId }, "Reseller LetterXpress config deleted");
  return { ok: true };
}

export async function getResellerLetterxpressStatus() {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;
  return getLetterxpressStatus(resellerId);
}
