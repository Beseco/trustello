import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey, requireScope, handleApiAuthError } from "@/lib/api-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET /api/v1/customers — Scope: customers:read
export async function GET(request: NextRequest) {
  try {
    const auth = await validateApiKey(request);
    requireScope(auth, "customers:read");

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const take = Math.min(Number(searchParams.get("limit") ?? "100"), 500);

    const customers = await prisma.customer.findMany({
      where: {
        tenantId: auth.tenantId,
        ...(q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take,
      select: {
        id: true,
        salutation: true,
        firstName: true,
        lastName: true,
        email: true,
        mobilePhone: true,
        street: true,
        zipCode: true,
        city: true,
        trustLevel: true,
        hasAccount: true,
        createdAt: true,
      },
    });

    return Response.json({ data: customers, count: customers.length });
  } catch (err) {
    return handleApiAuthError(err);
  }
}

const createSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  salutation: z.string().optional(),
  mobilePhone: z.string().optional(),
  street: z.string().optional(),
  zipCode: z.string().optional(),
  city: z.string().optional(),
});

// POST /api/v1/customers — Scope: customers:write
export async function POST(request: NextRequest) {
  try {
    const auth = await validateApiKey(request);
    requireScope(auth, "customers:write");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Validierungsfehler.", details: parsed.error.issues },
        { status: 422 },
      );
    }

    const existing = await prisma.customer.findFirst({
      where: { tenantId: auth.tenantId, email: parsed.data.email },
      select: { id: true },
    });
    if (existing) {
      return Response.json(
        { error: "Ein Kunde mit dieser E-Mail-Adresse existiert bereits." },
        { status: 409 },
      );
    }

    const customer = await prisma.customer.create({
      data: {
        tenantId: auth.tenantId,
        ...parsed.data,
        visibility: "ORGANISATION",
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
      },
    });

    return Response.json({ data: customer }, { status: 201 });
  } catch (err) {
    return handleApiAuthError(err);
  }
}
