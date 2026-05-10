import { requireEmployee } from "@/lib/auth-helpers";
import { DashboardLayout } from "@/components/shared/DashboardLayout";

export const dynamic = "force-dynamic";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const session = await requireEmployee();
  return (
    <DashboardLayout
      variant="employee"
      user={{ name: session.user.name, email: session.user.email }}
    >
      {children}
    </DashboardLayout>
  );
}
