import { requireReseller } from "@/lib/auth-helpers";
import { DashboardLayout } from "@/components/shared/DashboardLayout";

export default async function ResellerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireReseller();
  return (
    <DashboardLayout variant="reseller" user={{ name: session.user.name, email: session.user.email }}>
      {children}
    </DashboardLayout>
  );
}
