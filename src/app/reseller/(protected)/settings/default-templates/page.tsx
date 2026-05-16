import { requireReseller } from "@/lib/auth-helpers";
import { getResellerDefaultTemplates } from "@/server/actions/reseller-default-templates";
import { DefaultTemplateManager } from "./DefaultTemplateManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DefaultTemplatesPage() {
  await requireReseller();
  const templates = await getResellerDefaultTemplates();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Standard-Vorlagen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Diese Vorlagen werden beim Anlegen eines neuen Mandanten automatisch als globale
          Vorlagen kopiert. Bestehende Mandanten werden nicht beeinflusst.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Vorlagen verwalten
          </CardTitle>
          <CardDescription>
            Mandanten-Admins können die kopierten Vorlagen anpassen oder löschen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DefaultTemplateManager templates={templates} />
        </CardContent>
      </Card>
    </div>
  );
}
