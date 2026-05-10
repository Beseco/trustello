"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Inbox,
  Settings,
  Users,
  LayoutDashboard,
  LogOut,
  Building2,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const employeeNav: NavItem[] = [
  { href: "/inbox", label: "Posteingang", icon: <Inbox className="h-4 w-4" /> },
];

const adminNav: NavItem[] = [
  { href: "/admin", label: "Übersicht", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/admin/users", label: "Benutzer", icon: <Users className="h-4 w-4" /> },
  { href: "/admin/organisation", label: "Organisation", icon: <Building2 className="h-4 w-4" /> },
  { href: "/admin/settings", label: "Einstellungen", icon: <Settings className="h-4 w-4" /> },
];

type DashboardLayoutProps = {
  children: React.ReactNode;
  user?: { name?: string | null; email?: string | null };
  variant?: "employee" | "admin";
};

export function DashboardLayout({
  children,
  user,
  variant = "employee",
}: DashboardLayoutProps) {
  const pathname = usePathname();
  const navItems = variant === "admin" ? adminNav : employeeNav;

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="flex w-60 flex-col border-r bg-muted/40">
        <div className="flex h-14 items-center px-4">
          <Link href={variant === "admin" ? "/admin" : "/inbox"}>
            <Logo />
          </Link>
        </div>
        <Separator />
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-2",
                  pathname === item.href && "bg-accent text-accent-foreground",
                )}
              >
                {item.icon}
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>
        <Separator />
        <div className="flex items-center gap-3 p-4">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.name ?? "Unbekannt"}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</p>
          </div>
          <form action="/api/auth/signout" method="post">
            <Button variant="ghost" size="icon" title="Abmelden" type="submit">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex-1 p-6">{children}</div>
      </main>
    </div>
  );
}
