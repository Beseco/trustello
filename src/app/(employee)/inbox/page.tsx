import { requireEmployee } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { Inbox } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const session = await requireEmployee();
  const tenantId = session.user.tenantId!;

  const messageCount = await prisma.message.count({
    where: { tenantId, deletedAt: null },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Posteingang</h1>

      {messageCount === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-16 text-center">
          <Inbox className="mb-4 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Keine Nachrichten vorhanden</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Gesendete Nachrichten erscheinen hier, sobald Bürger diese abgerufen haben.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{messageCount} Nachricht(en) vorhanden.</p>
      )}
    </div>
  );
}
