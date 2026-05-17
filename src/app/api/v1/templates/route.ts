import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey, requireScope, handleApiAuthError } from "@/lib/api-auth";
import { handleOptions } from "@/lib/cors";

export const dynamic = "force-dynamic";

export function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

// GET /api/v1/templates — Scope: messages:read
// Gibt öffentliche Vorlagen des Mandanten zurück (für Add-in Template-Picker).
export async function GET(request: NextRequest) {
  try {
    const auth = await validateApiKey(request);
    requireScope(auth, "messages:read");

    const templates = await prisma.messageTemplate.findMany({
      where: {
        tenantId: auth.tenantId,
        scope: "GLOBAL",
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        subject: true,
        body: true,
      },
    });

    return Response.json(templates);
  } catch (err) {
    return handleApiAuthError(err);
  }
}
