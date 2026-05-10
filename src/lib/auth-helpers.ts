import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { UserRole } from "@prisma/client";

export async function requireEmployee() {
  const session = await auth();
  if (!session?.user || session.user.userType !== "employee") {
    redirect("/login");
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
    redirect("/login");
  }
  return session;
}
