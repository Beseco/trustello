import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { CitizenLoginForm } from "./CitizenLoginForm";

type PageProps = { params: Promise<{ slug: string }> };

export default async function CitizenLoginPage({ params }: PageProps) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, status: true },
  });

  if (!tenant || !["ACTIVE", "TRIAL"].includes(tenant.status)) notFound();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Bürger-Portal</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tenant.name}</p>
        </div>
        <div className="rounded-xl border bg-background p-6 shadow-sm">
          <Suspense>
            <CitizenLoginForm slug={slug} tenantName={tenant.name} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
