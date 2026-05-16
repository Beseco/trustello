import type { NextAuthConfig } from "next-auth";

// Edge-compatible auth config: no Node.js native modules, no Prisma, no argon2.
// Used by the proxy (middleware) to protect routes without loading heavy server-side deps.
export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    // Kopiert userType + roles aus dem JWT-Token in die Session — benötigt vom Proxy für Route-Schutz
    session({ session, token }) {
      const t = token as { userType?: string; roles?: string[] };
      const u = session.user as { userType?: string; roles?: string[] };
      u.userType = t.userType;
      u.roles = t.roles ?? [];
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { nextUrl } = request;
      const pathname = nextUrl.pathname;

      // Public routes
      if (
        pathname === "/" ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/register") ||
        pathname.startsWith("/forgot-password") ||
        pathname.startsWith("/reset-password") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/health") ||
        pathname.startsWith("/api/v1/") ||
        pathname.startsWith("/api/cron/") ||
        pathname.startsWith("/m/") ||
        pathname.match(/^\/portal\/[^/]+\/login$/) ||
        // Bürger-Postfach: Login + Registrierung sind öffentlich
        pathname === "/postfach/login" ||
        pathname.startsWith("/postfach/registrieren") ||
        pathname.startsWith("/postfach/passwort-vergessen") ||
        pathname.startsWith("/postfach/passwort-reset") ||
        pathname === "/reseller/login" ||
        pathname === "/reseller/passwort-vergessen" ||
        pathname === "/reseller/passwort-reset"
      ) {
        return true;
      }

      const user = auth?.user as { userType?: string; roles?: string[] } | undefined;
      const userType = user?.userType;
      const roles: string[] = user?.roles ?? [];

      // /reseller/** braucht reseller-Session — eigene Login-Seite statt globalem /login
      if (pathname.startsWith("/reseller")) {
        if (isLoggedIn && userType === "reseller") return true;
        return Response.redirect(new URL("/reseller/login", request.url));
      }

      if (!isLoggedIn) return false;
      // /admin erfordert Mitarbeiter-Session UND TENANT_ADMIN-Rolle
      if (pathname.startsWith("/admin")) {
        return userType === "employee" && roles.includes("TENANT_ADMIN");
      }
      if (
        pathname.startsWith("/inbox") ||
        pathname.startsWith("/compose") ||
        pathname.startsWith("/settings") ||
        pathname.startsWith("/customers")
      ) {
        return userType === "employee";
      }
      if (pathname.startsWith("/portal")) return userType === "customer";
      // Bürger-Postfach
      if (pathname.startsWith("/postfach")) return userType === "citizen";

      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
