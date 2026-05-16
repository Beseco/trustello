import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import * as argon2 from "argon2";
import { prisma } from "@/lib/db";
import type { UserRole } from "@prisma/client";
import { authConfig } from "@/auth.config";
import { checkRateLimit } from "@/lib/rate-limit";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      userType: "employee" | "reseller" | "customer" | "citizen";
      tenantId?: string;
      resellerId?: string;
      citizenAccountId?: string;
      roles: UserRole[];
    } & DefaultSession["user"];
  }

  interface User {
    userType: "employee" | "reseller" | "customer" | "citizen";
    tenantId?: string;
    resellerId?: string;
    citizenAccountId?: string;
    roles?: UserRole[];
  }
}

// next-auth v5 JWT augmentation — import path varies by version
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TrustelloJWT = Record<string, any> & {
  id: string;
  userType: "employee" | "reseller" | "customer" | "citizen";
  tenantId?: string;
  resellerId?: string;
  citizenAccountId?: string;
  roles: UserRole[];
};

const AUTH_MAX_ATTEMPTS = 10;
const AUTH_WINDOW_MS = 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "employee-credentials",
      name: "Mitarbeiter",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
        totpCode: { label: "2FA-Code", type: "text" },
        _ip: { label: "_ip", type: "hidden" },
      },
      async authorize(credentials) {
        const ip = String(credentials._ip ?? "unknown");
        if (!(await checkRateLimit(`auth:${ip}`, AUTH_MAX_ATTEMPTS, AUTH_WINDOW_MS))) return null;

        const email = String(credentials.email ?? "")
          .toLowerCase()
          .trim();
        const password = String(credentials.password ?? "");

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { tenant: { select: { id: true, status: true } } },
        });

        if (!user?.passwordHash) return null;
        if (!user.isActive) return null;
        if (!["ACTIVE", "TRIAL"].includes(user.tenant.status)) return null;

        const valid = await argon2.verify(user.passwordHash, password);
        if (!valid) return null;

        if (user.totpEnabled) {
          const totpCode = String(credentials.totpCode ?? "");
          if (!totpCode) return null;
          const { TOTP } = await import("otpauth");
          const totp = new TOTP({ secret: user.totpSecret ?? "" });
          const delta = totp.validate({ token: totpCode, window: 1 });
          if (delta === null) return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          userType: "employee",
          tenantId: user.tenantId,
          roles: user.roles,
        };
      },
    }),

    Credentials({
      id: "reseller-credentials",
      name: "Reseller",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
        totpCode: { label: "2FA-Code", type: "text" },
        _ip: { label: "_ip", type: "hidden" },
      },
      async authorize(credentials) {
        const ip = String(credentials._ip ?? "unknown");
        if (!(await checkRateLimit(`auth:${ip}`, AUTH_MAX_ATTEMPTS, AUTH_WINDOW_MS))) return null;

        const email = String(credentials.email ?? "")
          .toLowerCase()
          .trim();
        const password = String(credentials.password ?? "");

        if (!email || !password) return null;

        const admin = await prisma.resellerAdmin.findUnique({ where: { email } });
        if (!admin) return null;

        const valid = await argon2.verify(admin.passwordHash, password);
        if (!valid) return null;

        if (admin.totpEnabled) {
          const totpCode = String(credentials.totpCode ?? "");
          if (!totpCode) return null;
          const { TOTP } = await import("otpauth");
          const totp = new TOTP({ secret: admin.totpSecret ?? "" });
          const delta = totp.validate({ token: totpCode, window: 1 });
          if (delta === null) return null;
        }

        await prisma.resellerAdmin.update({
          where: { id: admin.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: admin.id,
          email: admin.email,
          name: admin.email.split("@")[0] ?? admin.email,
          userType: "reseller",
          resellerId: admin.resellerId,
          roles: [],
        };
      },
    }),

    Credentials({
      id: "customer-credentials",
      name: "Bürger (Mandant)",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
        totpCode: { label: "2FA-Code", type: "text" },
        tenantSlug: { label: "Mandant", type: "text" },
        _ip: { label: "_ip", type: "hidden" },
      },
      async authorize(credentials) {
        const ip = String(credentials._ip ?? "unknown");
        if (!(await checkRateLimit(`auth:${ip}`, AUTH_MAX_ATTEMPTS, AUTH_WINDOW_MS))) return null;

        const email = String(credentials.email ?? "")
          .toLowerCase()
          .trim();
        const password = String(credentials.password ?? "");
        const tenantSlug = String(credentials.tenantSlug ?? "").trim();

        if (!email || !password || !tenantSlug) return null;

        const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
        if (!tenant) return null;

        const customer = await prisma.customer.findUnique({
          where: { tenantId_email: { tenantId: tenant.id, email } },
        });

        if (!customer?.hasAccount || !customer.passwordHash) return null;

        const valid = await argon2.verify(customer.passwordHash, password);
        if (!valid) return null;

        if (customer.totpEnabled) {
          const totpCode = String(credentials.totpCode ?? "");
          if (!totpCode) return null;
          const { TOTP } = await import("otpauth");
          const totp = new TOTP({ secret: customer.totpSecret ?? "" });
          const delta = totp.validate({ token: totpCode.replace(/\s/g, ""), window: 1 });
          if (delta === null) return null;
        }

        return {
          id: customer.id,
          email: customer.email,
          name: `${customer.firstName} ${customer.lastName}`,
          userType: "customer",
          tenantId: customer.tenantId,
          roles: [],
        };
      },
    }),

    // Globales Bürger-Postfach — mandantenübergreifend
    Credentials({
      id: "citizen-account-credentials",
      name: "Bürger-Postfach",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
        totpCode: { label: "2FA-Code", type: "text" },
        _ip: { label: "_ip", type: "hidden" },
      },
      async authorize(credentials) {
        const ip = String(credentials._ip ?? "unknown");
        if (!(await checkRateLimit(`auth:${ip}`, AUTH_MAX_ATTEMPTS, AUTH_WINDOW_MS))) return null;

        const email = String(credentials.email ?? "").toLowerCase().trim();
        const password = String(credentials.password ?? "");
        if (!email || !password) return null;

        const ca = await prisma.citizenAccount.findUnique({ where: { email } });
        if (!ca?.passwordHash) return null;

        const valid = await argon2.verify(ca.passwordHash, password);
        if (!valid) return null;

        if (ca.totpEnabled) {
          const totpCode = String(credentials.totpCode ?? "");
          if (!totpCode) return null;
          const { TOTP } = await import("otpauth");
          const totp = new TOTP({ secret: ca.totpSecret ?? "" });
          const delta = totp.validate({ token: totpCode.replace(/\s/g, ""), window: 1 });
          if (delta === null) return null;
        }

        return {
          id: ca.id,
          email: ca.email,
          name: `${ca.firstName} ${ca.lastName}`,
          userType: "citizen",
          citizenAccountId: ca.id,
          roles: [],
        };
      },
    }),
  ],

  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },

  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user) {
        const t = token as TrustelloJWT;
        t.id = user.id as string;
        t.userType = user.userType;
        t.tenantId = user.tenantId;
        t.resellerId = user.resellerId;
        t.citizenAccountId = user.citizenAccountId;
        t.roles = user.roles ?? [];
      }
      return token;
    },
    session({ session, token }) {
      const t = token as TrustelloJWT;
      session.user.id = t.id;
      session.user.userType = t.userType;
      session.user.tenantId = t.tenantId;
      session.user.resellerId = t.resellerId;
      session.user.citizenAccountId = t.citizenAccountId;
      session.user.roles = t.roles;
      return session;
    },
  },

  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
});
