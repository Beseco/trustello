"use server";

import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { z } from "zod";
import { revalidatePath } from "next/cache";

export type CustomerSearchResult = {
  id: string;
  salutation: string | null;
  firstName: string;
  lastName: string;
  email: string;
  citizenAccountId: string | null;
  mobilePhone: string | null;
};

export async function searchCustomers(query: string): Promise<CustomerSearchResult[]> {
  const { tenantId } = await getTenantContext();

  if (!query || query.trim().length < 2) return [];

  return prisma.customer.findMany({
    where: {
      tenantId,
      OR: [
        { email: { contains: query.trim(), mode: "insensitive" } },
        { firstName: { contains: query.trim(), mode: "insensitive" } },
        { lastName: { contains: query.trim(), mode: "insensitive" } },
      ],
    },
    take: 10,
    select: { id: true, salutation: true, firstName: true, lastName: true, email: true, citizenAccountId: true, mobilePhone: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

const createCustomerSchema = z.object({
  salutation: z.string().optional(),
  firstName: z.string().min(1, "Vorname erforderlich"),
  lastName: z.string().min(1, "Nachname erforderlich"),
  email: z.string().email("Ungültige E-Mail-Adresse"),
  mobilePhone: z.string().optional(),
  street: z.string().optional(),
  zipCode: z.string().optional(),
  city: z.string().optional(),
  visibility: z.enum(["PRIVATE", "ORGANISATION", "OU"]).default("PRIVATE"),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type CreateCustomerResult = { customerId?: string; error?: string };

export async function createCustomer(data: CreateCustomerInput): Promise<CreateCustomerResult> {
  const parsed = createCustomerSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  let tenantId: string;
  let userId: string;
  try {
    ({ tenantId, userId } = await getTenantContext());
  } catch {
    return { error: "Nicht authentifiziert" };
  }

  const existing = await prisma.customer.findUnique({
    where: { tenantId_email: { tenantId, email: parsed.data.email.toLowerCase() } },
  });
  if (existing) return { error: "Ein Kunde mit dieser E-Mail-Adresse existiert bereits" };

  const customer = await prisma.customer.create({
    data: {
      tenantId,
      ownerUserId: userId,
      salutation: parsed.data.salutation || null,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email.toLowerCase(),
      mobilePhone: parsed.data.mobilePhone || null,
      street: parsed.data.street || null,
      zipCode: parsed.data.zipCode || null,
      city: parsed.data.city || null,
      visibility: parsed.data.visibility,
    },
  });

  revalidatePath("/admin/customers");
  return { customerId: customer.id };
}

/** Schnelles Anlegen eines neuen Kunden direkt aus dem Compose-Dialog.
 *  Gibt den neuen Customer mit den für die Suche benötigten Feldern zurück. */
export async function quickCreateCustomer(data: {
  firstName: string;
  lastName: string;
  email: string;
}): Promise<{ customer?: CustomerSearchResult; error?: string }> {
  let tenantId: string;
  let userId: string;
  try {
    ({ tenantId, userId } = await getTenantContext());
  } catch {
    return { error: "Nicht authentifiziert" };
  }

  const emailLower = data.email.trim().toLowerCase();
  if (!emailLower || !data.firstName.trim() || !data.lastName.trim()) {
    return { error: "Vorname, Nachname und E-Mail sind erforderlich" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
    return { error: "Ungültige E-Mail-Adresse" };
  }

  const existing = await prisma.customer.findUnique({
    where: { tenantId_email: { tenantId, email: emailLower } },
    select: { id: true, salutation: true, firstName: true, lastName: true, email: true, citizenAccountId: true, mobilePhone: true },
  });
  if (existing) {
    // Bereits vorhanden → einfach zurückgeben
    return { customer: existing };
  }

  const customer = await prisma.customer.create({
    data: {
      tenantId,
      ownerUserId: userId,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: emailLower,
      visibility: "PRIVATE",
    },
    select: { id: true, salutation: true, firstName: true, lastName: true, email: true, citizenAccountId: true, mobilePhone: true },
  });

  revalidatePath("/admin/customers");
  return { customer };
}

export type UpdateCustomerResult = { error?: string };

const updateCustomerSchema = createCustomerSchema;

export async function updateCustomer(
  customerId: string,
  data: CreateCustomerInput,
): Promise<UpdateCustomerResult> {
  const parsed = updateCustomerSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  let tenantId: string;
  try {
    ({ tenantId } = await getTenantContext());
  } catch {
    return { error: "Nicht authentifiziert" };
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || customer.tenantId !== tenantId) return { error: "Kunde nicht gefunden" };

  // Prüfen ob E-Mail bereits von anderem Kunden belegt
  const emailConflict = await prisma.customer.findUnique({
    where: { tenantId_email: { tenantId, email: parsed.data.email.toLowerCase() } },
  });
  if (emailConflict && emailConflict.id !== customerId) {
    return { error: "Diese E-Mail-Adresse wird bereits von einem anderen Kunden verwendet" };
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      salutation: parsed.data.salutation || null,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email.toLowerCase(),
      mobilePhone: parsed.data.mobilePhone || null,
      street: parsed.data.street || null,
      zipCode: parsed.data.zipCode || null,
      city: parsed.data.city || null,
      visibility: parsed.data.visibility,
    },
  });

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${customerId}`);
  return {};
}
