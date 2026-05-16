import { requireEmployee } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { ComposeForm } from "@/components/compose/ComposeForm";
import { resolveSignature } from "@/lib/signature";
import { getMessageTemplates } from "@/server/actions/message-templates";
import { getMyOUs } from "@/server/actions/organisation";

export const dynamic = "force-dynamic";

export default async function ComposePage() {
  const session = await requireEmployee();
  const userId = session.user.id!;
  const tenantId = session.user.tenantId!;

  const [user, settings, templates, myOUs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true, phone: true, position: true },
    }),
    prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { signatureTemplate: true },
    }),
    getMessageTemplates(),
    getMyOUs(),
  ]);

  const signature =
    user && settings?.signatureTemplate
      ? resolveSignature(settings.signatureTemplate, user)
      : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Neue Nachricht</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nachricht wird Ende-zu-Ende-verschlüsselt übermittelt.
        </p>
      </div>
      <div className="rounded-lg border bg-white p-6">
        <ComposeForm signature={signature} templates={templates} myOUs={myOUs} />
      </div>
    </div>
  );
}
