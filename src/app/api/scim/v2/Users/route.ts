import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { validateScimToken, scimError, handleScimAuthError } from "@/lib/scim-auth";
import { hash } from "argon2";
import { randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";

const SCIM_USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
const SCIM_LIST_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
const SCIM_HEADERS = { "Content-Type": "application/scim+json" };

function toScimUser(user: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  entraId: string | null;
}) {
  return {
    schemas: [SCIM_USER_SCHEMA],
    id: user.id,
    externalId: user.entraId ?? undefined,
    userName: user.email,
    name: {
      givenName: user.firstName,
      familyName: user.lastName,
      formatted: `${user.firstName} ${user.lastName}`,
    },
    emails: [{ value: user.email, primary: true }],
    active: user.isActive,
    meta: {
      resourceType: "User",
      location: `/api/scim/v2/Users/${user.id}`,
    },
  };
}

// GET /api/scim/v2/Users
export async function GET(request: NextRequest) {
  try {
    const auth = await validateScimToken(request);
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") ?? "";
    const startIndex = Math.max(1, Number(searchParams.get("startIndex") ?? "1"));
    const count = Math.min(100, Number(searchParams.get("count") ?? "100"));

    // SCIM-Filter: userName eq "email@example.com"
    let emailFilter: string | undefined;
    const filterMatch = /userName\s+eq\s+"([^"]+)"/i.exec(filter);
    if (filterMatch?.[1]) emailFilter = filterMatch[1];

    const users = await prisma.user.findMany({
      where: {
        tenantId: auth.tenantId,
        ...(emailFilter ? { email: emailFilter } : {}),
      },
      skip: startIndex - 1,
      take: count,
      select: { id: true, firstName: true, lastName: true, email: true, isActive: true, entraId: true },
    });

    const total = await prisma.user.count({ where: { tenantId: auth.tenantId } });

    return Response.json(
      {
        schemas: [SCIM_LIST_SCHEMA],
        totalResults: total,
        startIndex,
        itemsPerPage: users.length,
        Resources: users.map(toScimUser),
      },
      { headers: SCIM_HEADERS },
    );
  } catch (err) {
    return handleScimAuthError(err);
  }
}

// POST /api/scim/v2/Users
export async function POST(request: NextRequest) {
  try {
    const auth = await validateScimToken(request);
    const body = (await request.json()) as {
      userName?: string;
      name?: { givenName?: string; familyName?: string };
      active?: boolean;
      externalId?: string;
    };

    if (!body.userName) return scimError(400, "userName ist erforderlich.");

    const existing = await prisma.user.findUnique({ where: { email: body.userName } });
    if (existing) {
      // Idempotent: User existiert bereits → zurückgeben
      return Response.json(toScimUser(existing), { status: 200, headers: SCIM_HEADERS });
    }

    // Temporäres Passwort — User soll per Magic-Link / Passwort-Reset eingeloggt werden
    const tempPassword = randomBytes(16).toString("hex");
    const passwordHash = await hash(tempPassword);

    const user = await prisma.user.create({
      data: {
        tenantId: auth.tenantId,
        firstName: body.name?.givenName ?? "",
        lastName: body.name?.familyName ?? "",
        email: body.userName,
        isActive: body.active ?? true,
        entraId: body.externalId ?? null,
        roles: ["EMPLOYEE"],
        passwordHash,
      },
      select: { id: true, firstName: true, lastName: true, email: true, isActive: true, entraId: true },
    });

    return Response.json(toScimUser(user), { status: 201, headers: SCIM_HEADERS });
  } catch (err) {
    return handleScimAuthError(err);
  }
}
