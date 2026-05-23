"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Inbox,
  Settings,
  Users,
  LayoutDashboard,
  LogOut,
  Building2,
  PenSquare,
  ContactRound,
  KeyRound,
  ClipboardList,
  FileText,
  Mail,
  MessageSquare,
  MailOpen,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  section?: string;
};

const employeeNav: NavItem[] = [
  {
    href: "/inbox",
    label: "Nachrichten",
    icon: <Inbox className="h-4 w-4" />,
    section: "Nachrichten",
  },
  { href: "/compose", label: "Neue Nachricht", icon: <PenSquare className="h-4 w-4" /> },
  {
    href: "/customers",
    label: "Kunden",
    icon: <ContactRound className="h-4 w-4" />,
    section: "Verwaltung",
  },
  { href: "/settings/templates", label: "Meine Vorlagen", icon: <FileText className="h-4 w-4" /> },
  { href: "/settings", label: "Mein Konto", icon: <Settings className="h-4 w-4" /> },
];

const adminNav: NavItem[] = [
  {
    href: "/admin",
    label: "Übersicht",
    icon: <LayoutDashboard className="h-4 w-4" />,
    section: "Dashboard",
  },
  {
    href: "/admin/users",
    label: "Benutzer",
    icon: <Users className="h-4 w-4" />,
    section: "Verwaltung",
  },
  { href: "/admin/customers", label: "Kunden", icon: <ContactRound className="h-4 w-4" /> },
  { href: "/admin/organisation", label: "Organisation", icon: <Building2 className="h-4 w-4" /> },
  { href: "/admin/audit", label: "Audit-Log", icon: <ClipboardList className="h-4 w-4" /> },
  {
    href: "/admin/api-keys",
    label: "API-Keys",
    icon: <KeyRound className="h-4 w-4" />,
    section: "Konfiguration",
  },
  { href: "/admin/settings/templates", label: "Vorlagen", icon: <FileText className="h-4 w-4" /> },
  { href: "/admin/settings/smtp", label: "E-Mail (SMTP)", icon: <Mail className="h-4 w-4" /> },
  { href: "/admin/settings/scim", label: "Entra ID (SCIM)", icon: <Users className="h-4 w-4" /> },
  { href: "/admin/settings", label: "Einstellungen", icon: <Settings className="h-4 w-4" /> },
];

const resellerNav: NavItem[] = [
  {
    href: "/reseller",
    label: "Dashboard",
    icon: <LayoutDashboard className="h-4 w-4" />,
    section: "Übersicht",
  },
  {
    href: "/reseller/tenants",
    label: "Mandanten",
    icon: <Building2 className="h-4 w-4" />,
    section: "Verwaltung",
  },
  { href: "/reseller/plans", label: "Plans", icon: <Settings className="h-4 w-4" /> },
  {
    href: "/reseller/settings/smtp",
    label: "E-Mail (SMTP)",
    icon: <Mail className="h-4 w-4" />,
    section: "Konfiguration",
  },
  {
    href: "/reseller/settings/sipgate",
    label: "SMS (sipgate)",
    icon: <MessageSquare className="h-4 w-4" />,
  },
  {
    href: "/reseller/settings/letterxpress",
    label: "PIN-Brief",
    icon: <MailOpen className="h-4 w-4" />,
  },
  {
    href: "/reseller/settings/default-templates",
    label: "Standard-Vorlagen",
    icon: <FileText className="h-4 w-4" />,
  },
  { href: "/reseller/settings", label: "Mein Konto", icon: <Settings className="h-4 w-4" /> },
];

type DashboardLayoutProps = {
  children: React.ReactNode;
  user?: { name?: string | null; email?: string | null };
  variant?: "employee" | "admin" | "reseller";
  badges?: Record<string, number>;
  pageTitle?: string;
  headerActions?: React.ReactNode;
  isAdmin?: boolean;
};

export function DashboardLayout({
  children,
  user,
  variant = "employee",
  badges = {},
  pageTitle,
  headerActions,
  isAdmin = false,
}: DashboardLayoutProps) {
  const pathname = usePathname();
  const navItems =
    variant === "admin" ? adminNav : variant === "reseller" ? resellerNav : employeeNav;

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  // Group nav items by section
  const sections: { label: string | null; items: NavItem[] }[] = [];
  let currentSection: { label: string | null; items: NavItem[] } | null = null;
  for (const item of navItems) {
    if (item.section !== undefined) {
      currentSection = { label: item.section, items: [item] };
      sections.push(currentSection);
    } else {
      if (!currentSection) {
        currentSection = { label: null, items: [] };
        sections.push(currentSection);
      }
      currentSection.items.push(item);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar — dark navy */}
      <aside className="flex w-60 flex-shrink-0 flex-col" style={{ background: "#0f2744" }}>
        {/* Logo area */}
        <div
          className="flex h-14 items-center px-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <Link
            href={variant === "admin" ? "/admin" : variant === "reseller" ? "/reseller" : "/inbox"}
            className="flex flex-col"
          >
            <span className="text-lg font-bold leading-tight text-white tracking-tight">
              Trustello
            </span>
            <span
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "#7a9cc4" }}
            >
              Sicherer Datenaustausch
            </span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
          {sections.map((section, si) => (
            <div key={si}>
              {section.label && (
                <p
                  className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: "#4d7aaa", letterSpacing: "1px" }}
                >
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/admin" &&
                      item.href !== "/reseller" &&
                      item.href !== "/inbox" &&
                      pathname.startsWith(item.href + "/"));
                  const badge = badges[item.href];

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors",
                        isActive
                          ? "text-[#e8f2ff]"
                          : "text-[#94b8d8] hover:bg-white/[0.06] hover:text-[#d4e6f7]",
                      )}
                      style={isActive ? { background: "rgba(59,130,246,0.18)" } : undefined}
                    >
                      {/* Active indicator */}
                      {isActive && (
                        <span
                          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r"
                          style={{ background: "#3b82f6" }}
                        />
                      )}
                      <span className={cn("shrink-0", isActive ? "opacity-100" : "opacity-75")}>
                        {item.icon}
                      </span>
                      <span className="flex-1">{item.label}</span>
                      {badge != null && badge > 0 && (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Context switch link */}
        {(variant === "admin" || (variant === "employee" && isAdmin)) && (
          <div className="px-3 pb-2">
            <Link
              href={variant === "admin" ? "/inbox" : "/admin"}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors hover:bg-white/[0.06]"
              style={{
                color: "#7a9cc4",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                paddingTop: "10px",
              }}
            >
              {variant === "admin" ? (
                <>
                  <Inbox className="h-4 w-4 opacity-70" />
                  <span>Zum Posteingang</span>
                </>
              ) : (
                <>
                  <LayoutDashboard className="h-4 w-4 opacity-70" />
                  <span>Administration</span>
                </>
              )}
            </Link>
          </div>
        )}

        {/* User footer */}
        <div
          className="flex items-center gap-2.5 p-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback
              className="text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg, #3b82f6, #1e40af)" }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium" style={{ color: "#d4e6f7" }}>
              {user?.name ?? "Unbekannt"}
            </p>
            <p className="truncate text-[11px]" style={{ color: "#4d7aaa" }}>
              {user?.email ?? ""}
            </p>
          </div>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              title="Abmelden"
              className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-white/10"
              style={{ color: "#4d7aaa" }}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-white px-8 gap-4">
          {pageTitle ? (
            <h1 className="text-[16px] font-semibold text-foreground">{pageTitle}</h1>
          ) : (
            <div />
          )}
          {headerActions && <div className="flex items-center gap-3">{headerActions}</div>}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
