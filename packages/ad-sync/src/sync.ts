import type { Config } from "./config.js";
import { searchUsers } from "./ldap.js";
import { mapLdapUser, type MappedUser } from "./mapper.js";
import { TrustelloSyncClient, type TrustelloUser } from "./trustello.js";

export type SyncResult = {
  created: number;
  updated: number;
  deactivated: number;
  skipped: number;
  errors: number;
};

export async function runSync(config: Config): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, deactivated: 0, skipped: 0, errors: 0 };
  const client = new TrustelloSyncClient(config);
  const isDryRun = config.sync.dryRun;

  console.log(`[ad-sync] Starte${isDryRun ? " (DRY RUN)" : ""} LDAP-Sync...`);

  // 1. LDAP-User laden
  let ldapUsers: MappedUser[];
  try {
    const raw = await searchUsers(config);
    ldapUsers = raw
      .map((u) => mapLdapUser(u, config.sync.groupToOuMapping))
      .filter((u): u is MappedUser => u !== null);
    console.log(`[ad-sync] ${ldapUsers.length} User aus LDAP geladen`);
  } catch (err) {
    console.error("[ad-sync] LDAP-Fehler:", err);
    throw err;
  }

  // 2. Trustello-User laden
  let existingUsers: TrustelloUser[];
  try {
    existingUsers = await client.getUsers();
    console.log(`[ad-sync] ${existingUsers.length} User in Trustello vorhanden`);
  } catch (err) {
    console.error("[ad-sync] Trustello API-Fehler:", err);
    throw err;
  }

  // Index nach entraId und E-Mail
  const byEntraId = new Map<string, TrustelloUser>(
    existingUsers.filter((u) => u.entraId).map((u) => [u.entraId!, u]),
  );
  const byEmail = new Map<string, TrustelloUser>(existingUsers.map((u) => [u.email, u]));
  const ldapEntraIds = new Set(ldapUsers.map((u) => u.externalId));

  // 3. Neue und geänderte User synchronisieren
  for (const ldapUser of ldapUsers) {
    try {
      const existing = byEntraId.get(ldapUser.externalId) ?? byEmail.get(ldapUser.email);

      if (!existing) {
        // Neu anlegen
        console.log(`[ad-sync] NEU: ${ldapUser.email}`);
        if (!isDryRun) {
          await client.createUser({
            firstName: ldapUser.firstName,
            lastName: ldapUser.lastName,
            email: ldapUser.email,
            roles: [config.sync.defaultRole],
            entraId: ldapUser.externalId,
          });
        }
        result.created++;
      } else {
        // Änderungen prüfen
        const needsUpdate =
          existing.firstName !== ldapUser.firstName ||
          existing.lastName !== ldapUser.lastName ||
          existing.isActive !== ldapUser.isActive ||
          existing.entraId !== ldapUser.externalId;

        if (needsUpdate) {
          console.log(`[ad-sync] UPDATE: ${ldapUser.email}`);
          if (!isDryRun) {
            await client.updateUser(existing.id, {
              firstName: ldapUser.firstName,
              lastName: ldapUser.lastName,
              isActive: ldapUser.isActive,
              entraId: ldapUser.externalId,
            });
          }
          result.updated++;
        } else {
          result.skipped++;
        }
      }
    } catch (err) {
      console.error(`[ad-sync] Fehler bei ${ldapUser.email}:`, err);
      result.errors++;
    }
  }

  // 4. In Trustello aktive User deaktivieren die nicht mehr in LDAP sind
  for (const existing of existingUsers) {
    if (!existing.entraId) continue; // Nicht über SCIM/LDAP verwaltet
    if (existing.isActive && !ldapEntraIds.has(existing.entraId)) {
      console.log(`[ad-sync] DEAKTIVIEREN: ${existing.email} (nicht mehr in LDAP)`);
      if (!isDryRun) {
        await client.updateUser(existing.id, { isActive: false });
      }
      result.deactivated++;
    }
  }

  console.log(
    `[ad-sync] Fertig — Neu: ${result.created}, Aktualisiert: ${result.updated}, ` +
      `Deaktiviert: ${result.deactivated}, Unverändert: ${result.skipped}, Fehler: ${result.errors}`,
  );

  return result;
}
