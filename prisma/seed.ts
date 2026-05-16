import { PrismaClient, type SecurityLevel, type TrustLevel } from "@prisma/client";
import * as argon2 from "argon2";
import * as dotenv from "dotenv";
import { createTenantKeyMaterial } from "../src/lib/crypto/envelope";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 1. Reseller
  const reseller = await prisma.reseller.upsert({
    where: { id: "reseller-beseco" },
    update: {},
    create: {
      id: "reseller-beseco",
      name: "Beseco IT Systems",
      contactEmail: "florian@beubl.de",
    },
  });
  console.log("Reseller:", reseller.name);

  // 2. Plans
  const plans = await Promise.all([
    prisma.plan.upsert({
      where: { id: "plan-trial" },
      update: {},
      create: {
        id: "plan-trial",
        resellerId: reseller.id,
        name: "Trial",
        monthlyPrice: 0,
        setupFee: 0,
        maxUsers: 5,
        storageGB: 1,
        maxFileSizeMB: 10,
        retentionDays: 30,
        isTrial: true,
        trialDays: 30,
      },
    }),
    prisma.plan.upsert({
      where: { id: "plan-starter" },
      update: {},
      create: {
        id: "plan-starter",
        resellerId: reseller.id,
        name: "Starter",
        monthlyPrice: 29,
        setupFee: 99,
        maxUsers: 20,
        storageGB: 10,
        retentionDays: 90,
      },
    }),
    prisma.plan.upsert({
      where: { id: "plan-business" },
      update: {},
      create: {
        id: "plan-business",
        resellerId: reseller.id,
        name: "Business",
        monthlyPrice: 79,
        setupFee: 199,
        maxUsers: 100,
        storageGB: 50,
        maxFileSizeMB: 100,
        retentionDays: 180,
        hasAPI: true,
      },
    }),
    prisma.plan.upsert({
      where: { id: "plan-behoerde" },
      update: {},
      create: {
        id: "plan-behoerde",
        resellerId: reseller.id,
        name: "Behörde",
        monthlyPrice: 149,
        setupFee: 499,
        maxUsers: 500,
        storageGB: 200,
        maxFileSizeMB: 500,
        retentionDays: 365,
        hasOutlookAddin: true,
        hasBayernID: true,
        hasEID: true,
        hasAPI: true,
      },
    }),
  ]);
  console.log("Plans:", plans.map((p) => p.name).join(", "));

  // 3. Reseller Admin
  const resellerAdminHash = await argon2.hash("admin123!", { type: argon2.argon2id });
  const resellerAdmin = await prisma.resellerAdmin.upsert({
    where: { email: "florian@beubl.de" },
    update: {},
    create: {
      resellerId: reseller.id,
      email: "florian@beubl.de",
      passwordHash: resellerAdminHash,
      role: "OWNER",
    },
  });
  console.log("Reseller Admin:", resellerAdmin.email);

  // 4. Tenant — TMK mit Crypto anlegen
  const tmkMaterial = createTenantKeyMaterial();
  const businessPlan = plans.find((p) => p.id === "plan-business")!;

  const tenant = await prisma.tenant.upsert({
    where: { slug: "stadt-freising-demo" },
    update: {},
    create: {
      resellerId: reseller.id,
      planId: businessPlan.id,
      name: "Stadt Freising-Demo",
      slug: "stadt-freising-demo",
      billingEmail: "it@stadt-freising-demo.de",
      billingAddress: {
        street: "Hauptstraße 1",
        zipCode: "85354",
        city: "Freising",
        country: "DE",
      },
      autoLoginDomains: ["stadt-freising-demo.de"],
      tenantMasterKey: Buffer.from(
        tmkMaterial.tenantMasterKey,
      ) as unknown as Uint8Array<ArrayBuffer>,
      tmkIv: Buffer.from(tmkMaterial.tmkIv) as unknown as Uint8Array<ArrayBuffer>,
      tmkAuthTag: Buffer.from(tmkMaterial.tmkAuthTag) as unknown as Uint8Array<ArrayBuffer>,
      status: "ACTIVE",
    },
  });
  console.log("Tenant:", tenant.name, "| Slug:", tenant.slug);

  // 5. TenantSettings
  await prisma.tenantSettings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      allowEmployeeOUCreate: false,
      allowCustomerReplyDefault: true,
      allowSubjectEncryption: true,
      defaultSecurityLevel: "LEVEL_2" as SecurityLevel,
      defaultMinTrustLevel: "EMAIL" as TrustLevel,
    },
  });
  console.log("TenantSettings created");

  // 6. OUs
  const bauamt = await prisma.organisationUnit.upsert({
    where: { id: "ou-bauamt" },
    update: {},
    create: {
      id: "ou-bauamt",
      tenantId: tenant.id,
      name: "Bauamt",
      description: "Baugenehmigungen und Stadtplanung",
    },
  });
  const sozialamt = await prisma.organisationUnit.upsert({
    where: { id: "ou-sozialamt" },
    update: {},
    create: {
      id: "ou-sozialamt",
      tenantId: tenant.id,
      name: "Sozialamt",
      description: "Sozialleistungen und Beratung",
    },
  });
  console.log("OUs:", bauamt.name, sozialamt.name);

  // 7. Users
  const adminHash = await argon2.hash("Test1234!", { type: argon2.argon2id });
  const employeeHash = await argon2.hash("Test1234!", { type: argon2.argon2id });

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@stadt-freising-demo.de" },
    update: {},
    create: {
      tenantId: tenant.id,
      firstName: "Maria",
      lastName: "Müller",
      email: "admin@stadt-freising-demo.de",
      passwordHash: adminHash,
      roles: ["TENANT_ADMIN", "EMPLOYEE"],
    },
  });

  const bauamtUser = await prisma.user.upsert({
    where: { email: "hans.meier@stadt-freising-demo.de" },
    update: {},
    create: {
      tenantId: tenant.id,
      firstName: "Hans",
      lastName: "Meier",
      email: "hans.meier@stadt-freising-demo.de",
      passwordHash: employeeHash,
      roles: ["EMPLOYEE"],
    },
  });

  const sozialamtUser = await prisma.user.upsert({
    where: { email: "anna.schmidt@stadt-freising-demo.de" },
    update: {},
    create: {
      tenantId: tenant.id,
      firstName: "Anna",
      lastName: "Schmidt",
      email: "anna.schmidt@stadt-freising-demo.de",
      passwordHash: employeeHash,
      roles: ["EMPLOYEE"],
    },
  });

  // OU-Zuordnungen
  await prisma.userOnOU.upsert({
    where: { userId_ouId: { userId: bauamtUser.id, ouId: bauamt.id } },
    update: {},
    create: { userId: bauamtUser.id, ouId: bauamt.id, role: "MEMBER" },
  });
  await prisma.userOnOU.upsert({
    where: { userId_ouId: { userId: sozialamtUser.id, ouId: sozialamt.id } },
    update: {},
    create: { userId: sozialamtUser.id, ouId: sozialamt.id, role: "MEMBER" },
  });

  console.log("Users:", adminUser.email, bauamtUser.email, sozialamtUser.email);

  // 8. Customers
  const customer1 = await prisma.customer.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "max.mustermann@example.de" } },
    update: {},
    create: {
      tenantId: tenant.id,
      firstName: "Max",
      lastName: "Mustermann",
      email: "max.mustermann@example.de",
      mobilePhone: "+49 151 23456789",
      street: "Musterstraße 42",
      zipCode: "85354",
      city: "Freising",
      visibility: "PRIVATE",
      ownerUserId: bauamtUser.id,
      trustLevel: "EMAIL",
    },
  });

  const customer2 = await prisma.customer.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "erika.musterfrau@example.de" } },
    update: {},
    create: {
      tenantId: tenant.id,
      firstName: "Erika",
      lastName: "Musterfrau",
      email: "erika.musterfrau@example.de",
      street: "Bahnhofstraße 10",
      zipCode: "85354",
      city: "Freising",
      visibility: "ORGANISATION",
      trustLevel: "NONE",
    },
  });

  console.log("Customers:", customer1.email, customer2.email);

  // 9. Reseller Standard-Vorlagen
  await prisma.resellerDefaultTemplate.createMany({
    data: [
      {
        resellerId: reseller.id,
        name: "Zugangsdaten zusenden",
        subject: "Ihre Zugangsdaten",
        body: `<p>Sehr geehrte/r [Vorname] [Nachname],</p>
<p>hiermit erhalten Sie Ihre Zugangsdaten für unser Portal:</p>
<p><strong>Benutzername:</strong> [Benutzername / E-Mail-Adresse]<br>
<strong>Passwort:</strong> [Temporäres Passwort]</p>
<p>Bitte melden Sie sich unter folgendem Link an und ändern Sie Ihr Passwort bei der ersten Anmeldung:</p>
<p>[Link zum Portal]</p>
<p>Sollten Sie Fragen haben, stehen wir Ihnen gerne zur Verfügung.</p>
<p>Mit freundlichen Grüßen</p>`,
      },
    ],
    skipDuplicates: true,
  });

  console.log("\nSeed completed successfully!");
  console.log("\nTest-Zugangsdaten:");
  console.log("  Tenant-Admin:  admin@stadt-freising-demo.de / Test1234!");
  console.log("  Mitarbeiter:   hans.meier@stadt-freising-demo.de / Test1234!");
  console.log("  Reseller-Admin: florian@beubl.de / admin123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
