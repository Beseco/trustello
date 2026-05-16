import { requireEmployee } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CreateCustomerDialog } from "./CreateCustomerDialog";
import Link from "next/link";
import { Users, ChevronLeft, ChevronRight } from "lucide-react";
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

const VISIBILITY_LABELS = {
  PRIVATE: "Privat",
  ORGANISATION: "Organisation",
  OU: "OU",
};

const PAGE_SIZE = 50;

type PageProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

export default async function CustomersPage({ searchParams }: PageProps) {
  await requireEmployee();
  const { tenantId } = await getTenantContext();
  const { q, page: pageParam } = await searchParams;

  const page = Math.max(1, parseInt(pageParam ?? "1") || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where = {
    tenantId,
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { city: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        salutation: true,
        firstName: true,
        lastName: true,
        email: true,
        city: true,
        trustLevel: true,
        visibility: true,
        _count: { select: { receivedMessages: true } },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/admin/customers${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Kunden</h1>
          <p className="text-sm text-muted-foreground">{total} Einträge</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/customers/import"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            CSV-Import
          </Link>
          <CreateCustomerDialog />
        </div>
      </div>

      <form method="GET" className="flex gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Name, E-Mail oder Ort suchen…"
          className="max-w-xs"
        />
        <button
          type="submit"
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Suchen
        </button>
        {q && (
          <Link
            href="/admin/customers"
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Zurücksetzen
          </Link>
        )}
      </form>

      {customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-16 text-center">
          <Users className="mb-4 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">
            {q ? "Keine Treffer gefunden" : "Noch keine Kunden angelegt"}
          </p>
          {!q && (
            <p className="mt-1 text-sm text-muted-foreground">
              Kunden können manuell angelegt oder per Import hinzugefügt werden.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">E-Mail</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ort</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vertrauen</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sichtbarkeit</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nachrichten</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="font-medium hover:underline"
                      >
                        {c.salutation ? `${c.salutation} ` : ""}
                        {c.firstName} {c.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.city ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={c.trustLevel === "NONE" ? "outline" : "secondary"}
                        className="text-xs"
                      >
                        {TRUST_LABELS[c.trustLevel]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {VISIBILITY_LABELS[c.visibility]}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c._count.receivedMessages}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} von {total}
              </span>
              <div className="flex items-center gap-1">
                {page > 1 ? (
                  <Link
                    href={pageUrl(page - 1)}
                    className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 hover:bg-muted"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Zurück
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 opacity-40">
                    <ChevronLeft className="h-4 w-4" />
                    Zurück
                  </span>
                )}
                <span className="px-2">
                  Seite {page} / {totalPages}
                </span>
                {page < totalPages ? (
                  <Link
                    href={pageUrl(page + 1)}
                    className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 hover:bg-muted"
                  >
                    Weiter
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 opacity-40">
                    Weiter
                    <ChevronRight className="h-4 w-4" />
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
