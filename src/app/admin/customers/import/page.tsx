import { requireTenantAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImportForm } from "./ImportForm";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import type { ImportStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<ImportStatus, string> = {
  PENDING: "Ausstehend",
  RUNNING: "Läuft",
  COMPLETED: "Abgeschlossen",
  FAILED: "Fehlgeschlagen",
};

const STATUS_VARIANTS: Record<ImportStatus, "default" | "secondary" | "outline" | "destructive"> = {
  PENDING: "outline",
  RUNNING: "secondary",
  COMPLETED: "default",
  FAILED: "destructive",
};

export default async function CustomerImportPage() {
  await requireTenantAdmin();
  const { tenantId } = await getTenantContext();

  const jobs = await prisma.importJob.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Kunden importieren</h1>
        <p className="text-sm text-muted-foreground">
          CSV-Datei hochladen, um Kunden massenweise anzulegen oder zu aktualisieren.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">CSV-Import</CardTitle>
        </CardHeader>
        <CardContent>
          <ImportForm />
        </CardContent>
      </Card>

      {jobs.length > 0 && (
        <div className="max-w-2xl space-y-3">
          <h2 className="text-base font-semibold">Import-Verlauf</h2>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Datum</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Gesamt</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Erfolg</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Fehler</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {format(job.createdAt, "dd.MM.yyyy HH:mm", { locale: de })}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={STATUS_VARIANTS[job.status]} className="text-xs">
                        {STATUS_LABELS[job.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{job.totalRows}</td>
                    <td className="px-4 py-2.5 text-right text-green-700 dark:text-green-400">{job.successRows}</td>
                    <td className="px-4 py-2.5 text-right">
                      {job.errorRows > 0 ? (
                        <span className="text-destructive">{job.errorRows}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
