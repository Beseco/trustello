import type { LdapUser } from "./ldap.js";

// Bit 2 (0x0002) = Account disabled in Active Directory
const AD_DISABLED_BIT = 0x0002;

export type MappedUser = {
  externalId: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  ous: string[];
};

export function mapLdapUser(
  user: LdapUser,
  groupToOuMapping: Record<string, string> = {},
): MappedUser | null {
  const email = user.mail ?? user.userPrincipalName;
  if (!email) return null;

  const externalId = user.objectGUID;
  if (!externalId) return null;

  const isDisabled = ((user.userAccountControl ?? 0) & AD_DISABLED_BIT) !== 0;

  // OUs aus memberOf ableiten
  const ous: string[] = [];
  for (const group of user.memberOf ?? []) {
    const ouName = groupToOuMapping[group];
    if (ouName) ous.push(ouName);
  }

  return {
    externalId,
    firstName: user.givenName ?? "",
    lastName: user.sn ?? "",
    email,
    isActive: !isDisabled,
    ous,
  };
}
