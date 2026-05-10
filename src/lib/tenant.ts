import { auth } from "@/lib/auth";

export type TenantContext = {
  tenantId: string;
  userId: string;
};

/**
 * Reads tenantId and userId from the current auth session.
 * Throws if the session is missing or the user has no tenantId (e.g. reseller admins).
 * Use in every Server Action and Server Component that touches tenant data.
 */
export async function getTenantContext(): Promise<TenantContext> {
  const session = await auth();

  if (!session?.user) {
    throw new Error("Nicht authentifiziert");
  }

  const { tenantId, id: userId } = session.user as { tenantId?: string; id?: string };

  if (!tenantId) {
    throw new Error("Kein Mandanten-Kontext in der Session");
  }
  if (!userId) {
    throw new Error("Keine Benutzer-ID in der Session");
  }

  return { tenantId, userId };
}
