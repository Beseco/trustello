import { requireReseller } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResellerChangePasswordForm } from "./ResellerChangePasswordForm";
import { ResellerTotpSetup } from "./ResellerTotpSetup";

export const dynamic = "force-dynamic";

export default async function ResellerSettingsPage() {
  const session = await requireReseller();
  const adminId = session.user.id!;

  const admin = await prisma.resellerAdmin.findUnique({
    where: { id: adminId },
    select: { totpEnabled: true, email: true, role: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mein Konto</h1>
        <p className="text-sm text-muted-foreground">
          {admin?.email} · {admin?.role}
        </p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-base">Passwort ändern</CardTitle>
        </CardHeader>
        <CardContent>
          <ResellerChangePasswordForm />
        </CardContent>
      </Card>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-base">Zwei-Faktor-Authentifizierung</CardTitle>
        </CardHeader>
        <CardContent>
          <ResellerTotpSetup totpEnabled={admin?.totpEnabled ?? false} />
        </CardContent>
      </Card>
    </div>
  );
}
