import { requireTenantAdmin } from "@/lib/auth-helpers";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow, format } from "date-fns";
import { de } from "date-fns/locale";
import { CreateApiKeyDialog } from "./CreateApiKeyDialog";
import { DeleteApiKeyButton } from "./DeleteApiKeyButton";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  await requireTenantAdmin();
  const { tenantId } = await getTenantContext();

  const keys = await prisma.apiKey.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">API-Keys</h1>
          <p className="text-sm text-muted-foreground">{keys.length} API-Keys</p>
        </div>
        <CreateApiKeyDialog />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Berechtigungen</TableHead>
              <TableHead>Zuletzt verwendet</TableHead>
              <TableHead>Ablauf</TableHead>
              <TableHead>Erstellt</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map((key) => {
              const isExpired = key.expiresAt && key.expiresAt < new Date();
              return (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">
                    <span className={isExpired ? "text-muted-foreground line-through" : ""}>
                      {key.name}
                    </span>
                    {isExpired && (
                      <Badge variant="outline" className="ml-2 text-xs text-destructive">
                        Abgelaufen
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {key.scopes.map((scope) => (
                        <Badge key={scope} variant="secondary" className="font-mono text-xs">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {key.lastUsedAt
                      ? formatDistanceToNow(key.lastUsedAt, { addSuffix: true, locale: de })
                      : "Nie"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {key.expiresAt ? format(key.expiresAt, "dd.MM.yyyy") : "Kein Ablauf"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(key.createdAt, { addSuffix: true, locale: de })}
                  </TableCell>
                  <TableCell>
                    <DeleteApiKeyButton keyId={key.id} />
                  </TableCell>
                </TableRow>
              );
            })}
            {keys.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Noch keine API-Keys erstellt
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Hinweis zur Verwendung</p>
        <p className="mt-1">
          API-Keys werden als Bearer-Token im <code className="font-mono">Authorization</code>-Header
          übermittelt: <code className="font-mono">Authorization: Bearer tk_...</code>
        </p>
      </div>
    </div>
  );
}
