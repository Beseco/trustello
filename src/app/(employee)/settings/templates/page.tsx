import { requireEmployee } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { TemplateManager } from "@/app/admin/settings/templates/TemplateManager";

export const dynamic = "force-dynamic";

export default async function UserTemplatesPage() {
  const session = await requireEmployee();
  const userId = session.user.id!;
  const tenantId = session.user.tenantId!;

  const templates = await prisma.messageTemplate.findMany({
    where: { tenantId, scope: "USER", createdById: userId },
    orderBy: { name: "asc" },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Meine Vorlagen</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Persönliche Vorlagen — nur für Sie sichtbar
        </p>
      </div>

      <TemplateManager
        scope="USER"
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
