import { requireEmployee } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { DashboardLayout } from "@/components/shared/DashboardLayout";

export const dynamic = "force-dynamic";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const session = await requireEmployee();
  const { tenantId } = await getTenantContext();

  const now = new Date();
  // Ungelesene Bürger-Antworten an diesen Mitarbeiter
  const unreadCount = await prisma.message.count({
    where: {
      tenantId,
      recipientId: session.user.id,
      deletedAt: null,
      expiresAt: { gt: now },
      firstReadAt: null,
      events: { some: { eventType: "SENT", actorType: "CUSTOMER" } },
    },
  });

  const roles = (session.user.roles as string[]) ?? [];
  const isAdmin = roles.includes("TENANT_ADMIN");

  return (
    <DashboardLayout
      variant="employee"
      user={{ name: session.user.name, email: session.user.email }}
      badges={{ "/inbox": unreadCount }}
      isAdmin={isAdmin}
    >
      {children}
    </DashboardLayout>
  );
}
