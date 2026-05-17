import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey, handleApiAuthError } from "@/lib/api-auth";
import { handleOptions } from "@/lib/cors";

export const dynamic = "force-dynamic";

export function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

// GET /api/v1/me — kein Scope erforderlich (nur gültiger API-Key)
// Gibt Mandanten-Informationen zurück (für Add-in Initialisierung).
export async function GET(request: NextRequest) {
  try {
    const auth = await validateApiKey(request);

    const tenant = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { id: true, name: true, logoUrl: true },
    });

    if (!tenant) {
      return Response.json({ error: "Mandant nicht gefunden." }, { status: 404 });
    }

    return Response.json({
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantLogoUrl: tenant.logoUrl ?? null,
      scopes: auth.scopes,
    });
  } catch (err) {
    return handleApiAuthError(err);
  }
}
