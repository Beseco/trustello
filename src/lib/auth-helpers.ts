import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { UserRole } from "@prisma/client";

async function checkAndExpireTrialTenant(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { status: true, trialEndsAt: true },
  });
  if (tenant?.status === "TRIAL" && tenant.trialEndsAt && tenant.trialEndsAt < new Date()) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: "CANCELLED" },
    });
  }
}

export async function requireEmployee() {
  const session = await auth();
  if (!session?.user || session.user.userType !== "employee") {
    redirect("/login");
  }
  if (session.user.tenantId) {
    await checkAndExpireTrialTenant(session.user.tenantId);
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { status: true },
    });
    if (!tenant || !["ACTIVE", "TRIAL"].includes(tenant.status)) {
      redirect("/login?error=account_suspended");
    }
  }
  return session;
}

export async function requireTenantAdmin() {
  const session = await auth();
  if (!session?.user || session.user.userType !== "employee") {
    redirect("/login");
  }
  const roles = session.user.roles as UserRole[];
  if (!roles.includes("TENANT_ADMIN")) {
    redirect("/inbox");
  }
  return session;
}

export async function requireReseller() {
  const session = await auth();
  if (!session?.user || session.user.userType !== "reseller") {
    redirect("/reseller/login");
  }
  return session;
}

export async function requireCitizenAccount(): Promise<{
  citizenAccountId: string;
  email: string;
  name: string;
}> {
  const session = await auth();
  if (!session?.user || session.user.userType !== "citizen" || !session.user.citizenAccountId) {
    redirect("/postfach/login");
  }
  return {
    citizenAccountId: session.user.citizenAccountId,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
  };
}
