import { requireTenantAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { FileText } from "lucide-react";
import { TemplateManager } from "./TemplateManager";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const session = await requireTenantAdmin();
  const tenantId = session.user.tenantId!;

  const templates = await prisma.messageTemplate.findMany({
    where: { tenantId, scope: "GLOBAL" },
    orderBy: { name: "asc" },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Globale Vorlagen</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Für alle Mitarbeiter sichtbar — verwaltbar nur durch Admins
          </p>
        </div>
      </div>

      <TemplateManager
        scope="GLOBAL"
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          subject: t.subject,
          body: t.body,
          createdByName: t.createdBy ? `${t.createdBy.firstName} ${t.createdBy.lastName}` : "System",
        }))}
      />
    </div>
  );
}
