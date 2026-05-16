import Link from "next/link";
import { LogOut, Mail, UserCircle } from "lucide-react";

type Props = {
  tenantName: string;
  slug: string;
  customerName: string;
  activePath?: "messages" | "profile";
};

export function PortalHeader({ tenantName, slug, customerName, activePath }: Props) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        {/* Brand */}
        <div>
          <p className="text-xs text-muted-foreground">Bürger-Portal</p>
          <h1 className="font-semibold">{tenantName}</h1>
        </div>

        {/* Nav + user */}
        <div className="flex items-center gap-1 sm:gap-3">
          {/* Navigation */}
          <nav className="flex items-center">
            <Link
              href={`/portal/${slug}/dashboard`}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activePath === "messages"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Nachrichten</span>
            </Link>
            <Link
              href={`/portal/${slug}/profile`}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activePath === "profile"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Profil</span>
            </Link>
          </nav>

          {/* Divider */}
          <div className="hidden h-5 w-px bg-border sm:block" />

          {/* User + logout */}
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:block">{customerName}</span>
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                title="Abmelden"
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Abmelden</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
