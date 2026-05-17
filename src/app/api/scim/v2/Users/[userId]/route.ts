import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { validateScimToken, scimError, handleScimAuthError } from "@/lib/scim-auth";

export const dynamic = "force-dynamic";

const SCIM_USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
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

type Params = { params: Promise<{ userId: string }> };

// GET /api/scim/v2/Users/:userId
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await validateScimToken(request);
    const { userId } = await params;

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId: auth.tenantId },
      select: { id: true, firstName: true, lastName: true, email: true, isActive: true, entraId: true },
    });

    if (!user) return scimError(404, "User nicht gefunden.");
    return Response.json(toScimUser(user), { headers: SCIM_HEADERS });
  } catch (err) {
    return handleScimAuthError(err);
  }
}

// PUT /api/scim/v2/Users/:userId — vollständige Aktualisierung
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await validateScimToken(request);
    const { userId } = await params;
    const body = (await request.json()) as {
      userName?: string;
      name?: { givenName?: string; familyName?: string };
      active?: boolean;
      externalId?: string;
    };

    const existing = await prisma.user.findFirst({
      where: { id: userId, tenantId: auth.tenantId },
    });
    if (!existing) return scimError(404, "User nicht gefunden.");

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: body.name?.givenName ?? existing.firstName,
        lastName: body.name?.familyName ?? existing.lastName,
        email: body.userName ?? existing.email,
        isActive: body.active ?? existing.isActive,
        entraId: body.externalId ?? existing.entraId,
      },
      select: { id: true, firstName: true, lastName: true, email: true, isActive: true, entraId: true },
    });

    return Response.json(toScimUser(user), { headers: SCIM_HEADERS });
  } catch (err) {
    return handleScimAuthError(err);
  }
}

// PATCH /api/scim/v2/Users/:userId — partielle Aktualisierung
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await validateScimToken(request);
    const { userId } = await params;
    const body = (await request.json()) as {
      Operations?: Array<{ op: string; path?: string; value?: unknown }>;
    };

    const existing = await prisma.user.findFirst({
      where: { id: userId, tenantId: auth.tenantId },
    });
    if (!existing) return scimError(404, "User nicht gefunden.");

    const updates: Record<string, unknown> = {};
    for (const op of body.Operations ?? []) {
      const path = op.path?.toLowerCase();
      if (op.op.toLowerCase() === "replace") {
        if (path === "active") updates.isActive = op.value as boolean;
        if (path === "username") updates.email = op.value as string;
        if (path === "name.givenname") updates.firstName = op.value as string;
        if (path === "name.familyname") updates.lastName = op.value as string;
        if (path === "externalid") updates.entraId = op.value as string;
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: { id: true, firstName: true, lastName: true, email: true, isActive: true, entraId: true },
    });

    return Response.json(toScimUser(user), { headers: SCIM_HEADERS });
  } catch (err) {
    return handleScimAuthError(err);
  }
}

// DELETE /api/scim/v2/Users/:userId — Soft-Delete (isActive = false)
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await validateScimToken(request);
    const { userId } = await params;

    const existing = await prisma.user.findFirst({
      where: { id: userId, tenantId: auth.tenantId },
    });
    if (!existing) return scimError(404, "User nicht gefunden.");

    await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleScimAuthError(err);
  }
}
