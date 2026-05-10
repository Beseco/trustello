import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/shared/Logo";
import { Shield, Lock, FileCheck, ArrowRight, CheckCircle2 } from "lucide-react";

export default function MarketingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Anmelden
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Jetzt registrieren</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto flex max-w-5xl flex-1 flex-col items-center justify-center gap-8 px-4 py-24 text-center">
        <Badge variant="secondary" className="gap-1.5">
          <Shield className="h-3 w-3" />
          DSGVO-konform · Ende-zu-Ende-verschlüsselt
        </Badge>

        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Sicherer Datenaustausch zwischen{" "}
          <span className="text-primary">Behörden und Bürgern</span>
        </h1>

        <p className="max-w-2xl text-lg text-muted-foreground">
          Trustello ermöglicht Gemeinden, Städten und Landkreisen den vertraulichen
          Dokumentenaustausch mit Bürgern — einfach, sicher und gesetzeskonform.
          Die schlanke Alternative für kleinere Kommunen.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/login">
            <Button size="lg" className="gap-2">
              Zum Mitarbeiter-Login
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/register">
            <Button size="lg" variant="outline">
              Selbst registrieren
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/40 py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="mb-12 text-center text-2xl font-semibold">
            Warum Trustello?
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            <FeatureCard
              icon={<Lock className="h-5 w-5" />}
              title="Verschlüsselt"
              description="Alle Nachrichten und Anhänge werden mit AES-256-GCM Ende-zu-Ende verschlüsselt."
            />
            <FeatureCard
              icon={<FileCheck className="h-5 w-5" />}
              title="DSGVO-konform"
              description="Datenhaltung in Deutschland, vollständiges Audit-Log, gesetzeskonforme Aufbewahrungsfristen."
            />
            <FeatureCard
              icon={<Shield className="h-5 w-5" />}
              title="Einfache Integration"
              description="Keine spezielle Software für Bürger. Zugang über sichere Links im Browser — auf jedem Gerät."
            />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-4">
          <div className="grid gap-12 md:grid-cols-2">
            <div>
              <h2 className="mb-6 text-2xl font-semibold">Für Kommunen</h2>
              <ul className="space-y-3">
                {[
                  "Günstiger als FTAPI und vergleichbare Lösungen",
                  "Einfaches Onboarding für Mitarbeiter",
                  "Mandantenfähig für alle Ämter",
                  "Outlook-Integration (Phase 2)",
                  "BayernID & eID-Anbindung (Phase 2)",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="mb-6 text-2xl font-semibold">Für Bürger</h2>
              <ul className="space-y-3">
                {[
                  "Kein App-Download erforderlich",
                  "Zugang per sicherem Link per E-Mail",
                  "Anhänge sicher herunterladen und hochladen",
                  "Auf jedem Gerät nutzbar",
                  "Klare Datenschutzinformationen",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-5xl px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Beseco IT Systems, Freising. Alle Rechte vorbehalten.</p>
          <p className="mt-1">
            <a href="mailto:kontakt@trustello.de" className="hover:underline">
              kontakt@trustello.de
            </a>
            {" · "}
            <a href="/impressum" className="hover:underline">Impressum</a>
            {" · "}
            <a href="/datenschutz" className="hover:underline">Datenschutz</a>
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-6">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
