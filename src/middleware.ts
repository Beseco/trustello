import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req as NextRequest & { auth: typeof req.auth };
  const pathname = nextUrl.pathname;

  // Public routes
  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/m/")
  ) {
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  const userType = (session.user as { userType?: string })?.userType;

  // Reseller routes
  if (pathname.startsWith("/reseller")) {
    if (userType !== "reseller") {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }
    return NextResponse.next();
  }

  // Admin routes — only employees (role check happens in the page via requireTenantAdmin)
  if (pathname.startsWith("/admin")) {
    if (userType !== "employee") {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }
    return NextResponse.next();
  }

  // Employee routes
  if (pathname.startsWith("/inbox") || pathname.startsWith("/compose")) {
    if (userType !== "employee") {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
