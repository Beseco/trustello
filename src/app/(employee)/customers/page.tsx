import { requireEmployee } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Search, UserPlus, PenSquare } from "lucide-react";
import type { TrustLevel } from "@prisma/client";

export const dynamic = "force-dynamic";

const TRUST_LABELS: Record<TrustLevel, string> = {
  NONE: "—",
  EMAIL: "E-Mail",
  SMS: "SMS",
  PIN_LETTER: "PIN-Brief",
  BAYERN_ID_S: "BayernID (S)",
  BAYERN_ID_H: "BayernID (H)",
  EID: "eID",
};

const TRUST_VARIANTS: Record<TrustLevel, "outline" | "secondary" | "default"> = {
  NONE: "outline",
  EMAIL: "secondary",
  SMS: "secondary",
  PIN_LETTER: "secondary",
  BAYERN_ID_S: "default",
  BAYERN_ID_H: "default",
  EID: "default",
};

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function EmployeeCustomersPage({ searchParams }: PageProps) {
  await requireEmployee();
  const { tenantId } = await getTenantContext();
  const { q } = await searchParams;

  const customers = await prisma.customer.findMany({
    where: {
      tenantId,
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 200,
    select: {
      id: true,
      salutation: true,
      firstName: true,
      lastName: true,
      email: true,
      mobilePhone: true,
      city: true,
      trustLevel: true,
      hasAccount: true,
      _count: { select: { receivedMessages: { where: { deletedAt: null } } } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Kunden</h1>
          <p className="text-sm text-muted-foreground">{customers.length} Einträge</p>
        </div>
        <Link
          href="/customers/neu"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <UserPlus className="h-4 w-4" />
          Neuer Kunde
        </Link>
      </div>

      <form method="GET" className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={q}
          placeholder="Name, E-Mail oder Ort suchen…"
          className="pl-8"
        />
      </form>

      {customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-16 text-center">
          <p className="font-medium text-muted-foreground">
            {q ? `Keine Kunden für „${q}" gefunden` : "Noch keine Kunden angelegt"}
          </p>
          {!q && (
            <Link
              href="/customers/neu"
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Ersten Kunden anlegen
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">E-Mail</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ort</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vertrauen</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nachrichten</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/customers/${c.id}`} className="font-medium hover:underline">
                      {c.salutation ? `${c.salutation} ` : ""}
                      {c.firstName} {c.lastName}
                    </Link>
                    {c.hasAccount && (
                      <span className="ml-2 text-xs text-muted-foreground">· Konto</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.city ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={TRUST_VARIANTS[c.trustLevel]} className="text-xs">
                      {TRUST_LABELS[c.trustLevel]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c._count.receivedMessages > 0 ? c._count.receivedMessages : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/compose?recipientId=${c.id}`}
                      className="inline-flex items-center gap-1 rounded p-1 text-muted-foreground hover:text-foreground"
                      title="Nachricht schreiben"
                    >
                      <PenSquare className="h-4 w-4" />
                    </Link>
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
