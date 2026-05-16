import { requireTenantAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { Building2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { CreateOUDialog } from "./CreateOUDialog";
import { DeleteOUButton } from "./DeleteOUButton";
import { EditOUDialog } from "./EditOUDialog";

export const dynamic = "force-dynamic";

export default async function OrganisationPage() {
  const session = await requireTenantAdmin();
  const tenantId = session.user.tenantId!;

  const ous = await prisma.organisationUnit.findMany({
    where: { tenantId },
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
    include: {
      parent: { select: { name: true } },
      _count: { select: { members: true, customers: true, children: true } },
    },
  });

  // parentOptions: alle OUs außer sich selbst (wird pro Zeile gefiltert beim Edit-Dialog)
  const allOUOptions = ous.map((ou) => ({ id: ou.id, name: ou.name }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Organisationseinheiten</h1>
          <p className="text-sm text-muted-foreground">{ous.length} Einheiten</p>
        </div>
        <CreateOUDialog parentOptions={allOUOptions} />
      </div>

      {ous.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-16 text-center">
          <Building2 className="mb-4 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Noch keine Organisationseinheiten angelegt</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Gliedern Sie Ihre Behörde in Ämter, Abteilungen oder Referate.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Name</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Übergeordnet</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Beschreibung</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mitarbeiter</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Kunden</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {ous.map((ou) => (
                <tr
                  key={ou.id}
                  style={{ borderBottom: "1px solid #f1f5f9" }}
                  className="group last:border-0 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/admin/organisation/${ou.id}`}
                      className="flex items-center gap-1 hover:underline"
                    >
                      {ou.parentId && <span className="mr-1 text-muted-foreground">↳</span>}
                      {ou.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-[13px]">
                    {ou.parent?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-[13px] max-w-xs truncate">
                    {ou.description ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    <Link
                      href={`/admin/organisation/${ou.id}`}
                      className="font-semibold text-foreground hover:underline"
                    >
                      {ou._count.members}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    {ou._count.customers}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <EditOUDialog
                        ouId={ou.id}
                        defaultValues={{
                          name: ou.name,
                          description: ou.description ?? undefined,
                          parentId: ou.parentId ?? undefined,
                        }}
                        parentOptions={allOUOptions.filter((o) => o.id !== ou.id)}
                      />
                      <Link
                        href={`/admin/organisation/${ou.id}`}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Details"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                      <DeleteOUButton
                        ouId={ou.id}
                        hasChildren={ou._count.children > 0}
                        hasMembers={ou._count.members > 0}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
