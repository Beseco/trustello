import { notFound } from "next/navigation";
import Link from "next/link";
import { requireTenantAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { ArrowLeft, Building2, FileText, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { OUMemberManager } from "./OUMemberManager";
import { EditOUDialog } from "../EditOUDialog";
import { TemplateManager } from "@/app/admin/settings/templates/TemplateManager";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ ouId: string }> };

export default async function OUDetailPage({ params }: PageProps) {
  const session = await requireTenantAdmin();
  const tenantId = session.user.tenantId!;
  const { ouId } = await params;

  const [ou, allUsers, allOUs, ouTemplates] = await Promise.all([
    prisma.organisationUnit.findFirst({
      where: { id: ouId, tenantId },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true, _count: { select: { members: true } } } },
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                position: true,
                isActive: true,
                roles: true,
                lastLoginAt: true,
              },
            },
          },
          orderBy: { user: { firstName: "asc" } },
        },
        _count: { select: { members: true, customers: true, children: true } },
      },
    }),
    prisma.user.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true, position: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.organisationUnit.findMany({
      where: { tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.messageTemplate.findMany({
      where: { tenantId, scope: "OU", ouId },
      orderBy: { name: "asc" },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  if (!ou) notFound();

  const memberIds = new Set(ou.members.map((m) => m.userId));
  const nonMembers = allUsers.filter((u) => !memberIds.has(u.id));

  const ROLE_LABELS: Record<string, string> = {
    TENANT_ADMIN: "Admin",
    USER_MANAGER: "Nutzer",
    CUSTOMER_MANAGER: "Kunden",
    EMPLOYEE: "Mitarbeiter",
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/admin/organisation"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Organisationseinheiten
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{ou.name}</h1>
            {ou.parent && (
              <p className="text-sm text-muted-foreground">
                Untereinheit von{" "}
                <Link href={`/admin/organisation/${ou.parent.id}`} className="hover:underline">
                  {ou.parent.name}
                </Link>
              </p>
            )}
            {ou.description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{ou.description}</p>
            )}
          </div>
        </div>
        <EditOUDialog
          ouId={ou.id}
          defaultValues={{
            name: ou.name,
            description: ou.description ?? undefined,
            parentId: ou.parentId ?? undefined,
          }}
          parentOptions={allOUs.filter((o) => o.id !== ou.id)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Members */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-muted-foreground" />
                Mitarbeiter ({ou._count.members})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <OUMemberManager
                ouId={ou.id}
                members={ou.members.map((m) => ({
                  userId: m.userId,
                  firstName: m.user.firstName,
                  lastName: m.user.lastName,
                  email: m.user.email,
                  position: m.user.position,
                  isActive: m.user.isActive,
                  roles: m.user.roles,
                  lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null,
                  ouRole: m.role,
                }))}
                nonMembers={nonMembers}
              />
            </CardContent>
          </Card>
        </div>

        {/* OU Templates */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Vorlagen dieser Einheit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TemplateManager
                scope="OU"
                ouId={ou.id}
                templates={ouTemplates.map((t) => ({
                  id: t.id,
                  name: t.name,
                  subject: t.subject,
                  body: t.body,
                  createdByName: t.createdBy ? `${t.createdBy.firstName} ${t.createdBy.lastName}` : "System",
                }))}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Statistiken</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mitarbeiter</span>
                <span className="font-semibold">{ou._count.members}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Zugewiesene Kunden</span>
                <span className="font-semibold">{ou._count.customers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Untereinheiten</span>
                <span className="font-semibold">{ou._count.children}</span>
              </div>
            </CardContent>
          </Card>

          {/* Children */}
          {ou.children.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Untereinheiten</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ou.children.map((child) => (
                  <Link
                    key={child.id}
                    href={`/admin/organisation/${child.id}`}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/40"
                  >
                    <span className="font-medium">{child.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {child._count.members} Mitgl.
                    </Badge>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
