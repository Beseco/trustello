import { notFound } from "next/navigation";
import Link from "next/link";
import { requireTenantAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { ArrowLeft, Mail, Shield, Building2, KeyRound, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { EditProfileForm } from "./EditProfileForm";
import { OUManager } from "./OUManager";
import { RolesCard } from "./RolesCard";
import { DangerZone } from "./DangerZone";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ userId: string }> };

export default async function UserDetailPage({ params }: PageProps) {
  const session = await requireTenantAdmin();
  const tenantId = session.user.tenantId!;
  const { userId } = await params;

  const [user, allOUs] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: {
        ous: {
          include: { ou: { select: { id: true, name: true, parentId: true } } },
          orderBy: { ou: { name: "asc" } },
        },
      },
    }),
    prisma.organisationUnit.findMany({
      where: { tenantId },
      orderBy: [{ parentId: "asc" }, { name: "asc" }],
      select: { id: true, name: true, parentId: true },
    }),
  ]);

  if (!user) notFound();

  const isSelf = user.id === session.user.id;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Benutzerverwaltung
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {user.firstName} {user.lastName}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            {user.email}
            {!user.isActive && (
              <Badge variant="outline" className="ml-2 text-xs text-destructive border-destructive/30">
                Deaktiviert
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
          {user.lastLoginAt ? (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Letzter Login{" "}
              {formatDistanceToNow(user.lastLoginAt, { addSuffix: true, locale: de })}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-muted-foreground/60">
              <Clock className="h-3 w-3" />
              Noch nie eingeloggt
            </span>
          )}
          <span>Angelegt am {format(user.createdAt, "dd.MM.yyyy", { locale: de })}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Profile card */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Profil
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EditProfileForm
                userId={user.id}
                defaultValues={{
                  salutation: user.salutation ?? "",
                  firstName: user.firstName,
                  lastName: user.lastName,
                  phone: user.phone ?? "",
                  position: user.position ?? "",
                }}
              />
            </CardContent>
          </Card>

          {/* Roles card */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Rollen &amp; Berechtigungen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RolesCard userId={user.id} initialRoles={user.roles} isSelf={isSelf} />
            </CardContent>
          </Card>

          {/* OU assignments */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Organisationseinheiten
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OUManager
                userId={user.id}
                assignments={user.ous.map((uou) => ({
                  ouId: uou.ouId,
                  ouName: uou.ou.name,
                  role: uou.role,
                }))}
                availableOUs={allOUs.filter(
                  (ou) => !user.ous.some((uou) => uou.ouId === ou.id),
                )}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Reset password */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                Passwort
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DangerZone
                userId={user.id}
                isActive={user.isActive}
                isSelf={isSelf}
                variant="password"
              />
            </CardContent>
          </Card>

          {/* Account status */}
          {!isSelf && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base text-destructive">Konto-Status</CardTitle>
              </CardHeader>
              <CardContent>
                <DangerZone
                  userId={user.id}
                  isActive={user.isActive}
                  isSelf={isSelf}
                  variant="status"
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
