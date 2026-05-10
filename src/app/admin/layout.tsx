import { requireTenantAdmin } from "@/lib/auth-helpers";
import { DashboardLayout } from "@/components/shared/DashboardLayout";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireTenantAdmin();
  return (
    <DashboardLayout variant="admin" user={{ name: session.user.name, email: session.user.email }}>
      {children}
    </DashboardLayout>
  );
}
