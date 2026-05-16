import { auth } from "@/lib/auth";
import Link from "next/link";
import { Lock, Inbox, User, LogOut } from "lucide-react";

export default async function PostfachLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isLoggedIn = session?.user?.userType === "citizen";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Lock className="h-4 w-4 text-white" />
            </div>
            <div>
              <Link href="/postfach/inbox" className="text-base font-bold text-slate-900 hover:text-blue-600">
                Sicheres Postfach
              </Link>
              <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
                Ende-zu-Ende Verschlüsselung
              </p>
            </div>
          </div>

          {isLoggedIn && (
            <nav className="flex items-center gap-1">
              <Link
                href="/postfach/inbox"
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                <Inbox className="h-4 w-4" />
                Posteingang
              </Link>
              <Link
                href="/postfach/profil"
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                <User className="h-4 w-4" />
                Profil
              </Link>
              <form action="/api/auth/signout" method="POST">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  <LogOut className="h-4 w-4" />
                  Abmelden
                </button>
              </form>
            </nav>
          )}
        </div>

        {/* Security notice bar */}
        <div className="border-t bg-blue-50 px-4 py-1.5">
          <p className="mx-auto max-w-5xl text-center text-[11px] text-blue-700">
            🔒 Ihre Nachrichten werden verschlüsselt übertragen und gespeichert — nur Sie können sie lesen.
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
