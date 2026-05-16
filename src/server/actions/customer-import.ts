"use server";

import { prisma } from "@/lib/db";
import { requireTenantAdmin } from "@/lib/auth-helpers";
import { getTenantContext } from "@/lib/tenant";
import { revalidatePath } from "next/cache";

type ImportRow = {
  firstName: string;
  lastName: string;
  email: string;
  salutation?: string;
  mobilePhone?: string;
  street?: string;
  zipCode?: string;
  city?: string;
};

type ImportResult = {
  jobId: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  errors: Array<{ row: number; email: string; reason: string }>;
};

function parseCSV(text: string): ImportRow[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];

  const header = lines[0]!.split(";").map((h) => h.trim().toLowerCase());
  const rows: ImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;

    const cols = line.split(";").map((c) => c.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => {
      obj[h] = cols[idx] ?? "";
    });

    rows.push({
      firstName: obj["vorname"] ?? obj["firstname"] ?? obj["first_name"] ?? "",
      lastName: obj["nachname"] ?? obj["lastname"] ?? obj["last_name"] ?? obj["name"] ?? "",
      email: obj["email"] ?? obj["e-mail"] ?? "",
      salutation: obj["anrede"] ?? obj["salutation"] ?? undefined,
      mobilePhone: obj["mobil"] ?? obj["mobile"] ?? obj["telefon"] ?? obj["phone"] ?? undefined,
      street: obj["strasse"] ?? obj["straße"] ?? obj["street"] ?? undefined,
      zipCode: obj["plz"] ?? obj["zipcode"] ?? obj["zip_code"] ?? undefined,
      city: obj["ort"] ?? obj["stadt"] ?? obj["city"] ?? undefined,
    });
  }

  return rows;
}

export async function importCustomersFromCSV(
  csvText: string
): Promise<{ error?: string; result?: ImportResult }> {
  await requireTenantAdmin();
  const { tenantId } = await getTenantContext();

  if (!csvText.trim()) return { error: "Die CSV-Datei ist leer" };

  const rows = parseCSV(csvText);
  if (rows.length === 0) return { error: "Keine Datenzeilen gefunden" };
  if (rows.length > 1000) return { error: "Maximal 1.000 Zeilen pro Import erlaubt" };

  const job = await prisma.importJob.create({
    data: {
      tenantId,
      type: "CUSTOMERS",
      status: "RUNNING",
      totalRows: rows.length,
    },
  });

  const errors: ImportResult["errors"] = [];
  let successRows = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2; // 1-indexed, +1 for header

    if (!row.firstName.trim()) {
      errors.push({ row: rowNum, email: row.email, reason: "Vorname fehlt" });
      continue;
    }
    if (!row.lastName.trim()) {
      errors.push({ row: rowNum, email: row.email, reason: "Nachname fehlt" });
      continue;
    }
    if (!row.email.trim() || !row.email.includes("@")) {
      errors.push({ row: rowNum, email: row.email, reason: "Ungültige E-Mail-Adresse" });
      continue;
    }

    try {
      await prisma.customer.upsert({
        where: { tenantId_email: { tenantId, email: row.email.toLowerCase() } },
        create: {
          tenantId,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email.toLowerCase(),
          salutation: row.salutation || null,
          mobilePhone: row.mobilePhone || null,
          street: row.street || null,
          zipCode: row.zipCode || null,
          city: row.city || null,
        },
        update: {
          firstName: row.firstName,
          lastName: row.lastName,
          salutation: row.salutation || null,
          mobilePhone: row.mobilePhone || null,
          street: row.street || null,
          zipCode: row.zipCode || null,
          city: row.city || null,
        },
      });
      successRows++;
    } catch {
      errors.push({ row: rowNum, email: row.email, reason: "Datenbankfehler" });
    }
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: errors.length === rows.length ? "FAILED" : "COMPLETED",
      successRows,
      errorRows: errors.length,
      errorReport: errors.length > 0 ? errors : undefined,
    },
  });

  revalidatePath("/admin/customers");

  return {
    result: {
      jobId: job.id,
      totalRows: rows.length,
      successRows,
      errorRows: errors.length,
      errors,
    },
  };
}
