# Trustello

Sicherer Datenaustausch zwischen Behörden und Bürgern. Entwickelt für deutsche
Gemeinden, Städte und Landkreise.

## Was ist Trustello?

Trustello ist eine schlanke SaaS-Plattform für den vertraulichen Dokumentenaustausch
zwischen Behörden und Bürgern — eine günstigere Alternative zu FTAPI für kleinere Kommunen.

**Kernfunktionen:**

- Ende-zu-Ende-Verschlüsselung (AES-256-GCM, Envelope Encryption)
- Mehrmandantenfähig (Reseller → Mandant → Abteilung → Benutzer)
- Sicherer Bürger-Zugang per Magic-Link (kein App-Download)
- DSGVO-konform, Datenhaltung in Deutschland
- Vollständiges Audit-Log

## Voraussetzungen

- **Node.js** 20+
- **pnpm** 11+
- **Docker** (für lokale Services)

```bash
npm install -g pnpm
```

## Lokales Setup

```bash
# 1. Repository klonen
git clone git@github.com:Beseco/trustello.git
cd trustello

# 2. Umgebungsvariablen
cp .env.example .env
# .env öffnen und mindestens MASTER_KEY + NEXTAUTH_SECRET befüllen:
# MASTER_KEY=$(openssl rand -base64 32)
# NEXTAUTH_SECRET=$(openssl rand -base64 32)

# 3. Lokale Services starten (Postgres, ClamAV, Mailpit, Redis)
docker compose -f docker/docker-compose.dev.yml up -d

# 4. Abhängigkeiten installieren
pnpm install

# 5. Datenbank migrieren
pnpm db:migrate

# 6. Testdaten einspielen
pnpm db:seed

# 7. Entwicklungsserver starten
pnpm dev
```

Öffne [http://localhost:3000](http://localhost:3000).

## Test-Zugangsdaten (Seed)

| Rolle          | E-Mail                            | Passwort  |
| -------------- | --------------------------------- | --------- |
| Tenant-Admin   | admin@stadt-freising-demo.de      | Test1234! |
| Mitarbeiter    | hans.meier@stadt-freising-demo.de | Test1234! |
| Reseller-Admin | florian@beubl.de                  | admin123! |

**Selbstregistrierung:** E-Mail-Domain `@stadt-freising-demo.de` ist für Auto-Login freigeschaltet.

**Mailpit:** [http://localhost:8025](http://localhost:8025) — lokaler Mail-Catchall.

## Befehle

```bash
pnpm dev              # Entwicklungsserver
pnpm build            # Production Build
pnpm test:run         # Tests einmalig ausführen
pnpm test             # Tests im Watch-Modus
pnpm lint             # ESLint
pnpm format           # Prettier
pnpm db:migrate       # Neue Migration anlegen
pnpm db:seed          # Testdaten einspielen
pnpm db:studio        # Prisma Studio
```

## Architektur

```
src/
├── app/               Next.js App Router
│   ├── (marketing)/   Öffentliche Landingpage
│   ├── (auth)/        Login / Registrierung
│   ├── admin/         Tenant-Admin-Bereich
│   ├── (employee)/    Mitarbeiter-Posteingang
│   ├── m/[messageId]  Bürger-Portal (Magic-Links)
│   └── api/           NextAuth + Health-Check
├── components/
│   ├── ui/            shadcn/ui Komponenten
│   └── shared/        App-Layouts, Logo
├── lib/
│   ├── crypto/        AES-256-GCM Envelope Encryption
│   ├── mail/          Nodemailer + Templates
│   ├── storage/       S3-kompatibler Object Storage
│   ├── auth.ts        NextAuth.js v5 (3 Provider)
│   ├── db.ts          Prisma Client Singleton
│   └── tenant.ts      Tenant-Context-Helper
└── server/actions/    Server Actions
```

**Verschlüsselungs-Architektur (3 Ebenen):**

```
MASTER_KEY (env)
  └─ wraps → Tenant Master Key (DB, verschlüsselt)
               └─ wraps → Message Key (DB, verschlüsselt)
                            └─ encrypts → Nachrichteninhalt + Anhänge
```

## Tests

```bash
pnpm test:run
# Crypto-Layer: envelope.test.ts (15 Tests), kdf.test.ts (6 Tests)
```

Tests laufen mit Vitest. Nur der Crypto-Layer hat Tests in Phase 1 — kein Mock-Framework benötigt.

## Deployment (Hetzner Ubuntu 24.04)

Siehe [deploy/README.md](deploy/README.md) für die vollständige Server-Setup-Anleitung.

**Kurzversion:**

```
Nginx (TLS) → Docker Compose → Next.js (Port 3000 intern)
                             → PostgreSQL 16
                             → ClamAV (Virenscanner)
                             → Redis 7
```

Deployment erfolgt manuell per SSH + `git pull` + Docker Compose rebuild.
CI/CD-Automatisierung ist für Phase 2 geplant.

## Lizenz

Proprietär. Alle Rechte vorbehalten.
© 2024–2025 Florian Beubl, Beseco IT Systems, Freising.
Keine Weitergabe, Vervielfältigung oder Nutzung ohne ausdrückliche Genehmigung.
