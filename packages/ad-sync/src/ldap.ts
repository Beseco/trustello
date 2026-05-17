import ldap from "ldapjs";
import type { Config } from "./config.js";

export type LdapUser = {
  dn: string;
  objectGUID?: string;
  sAMAccountName?: string;
  userPrincipalName?: string;
  givenName?: string;
  sn?: string;
  mail?: string;
  mobile?: string;
  telephoneNumber?: string;
  userAccountControl?: number;
  memberOf?: string[];
};

function bufferToGuid(buf: Buffer): string {
  // Windows GUID in Little-Endian → Standard UUID Format
  const hex = buf.toString("hex");
  return [
    hex.slice(6, 8) + hex.slice(4, 6) + hex.slice(2, 4) + hex.slice(0, 2),
    hex.slice(10, 12) + hex.slice(8, 10),
    hex.slice(14, 16) + hex.slice(12, 14),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function parseAttribute(entry: ldap.SearchEntry, attr: string): string | undefined {
  const val = entry.attributes.find((a) => a.type.toLowerCase() === attr.toLowerCase());
  if (!val) return undefined;
  const values = val.values;
  return Array.isArray(values) ? values[0] : undefined;
}

function parseMultiAttribute(entry: ldap.SearchEntry, attr: string): string[] {
  const val = entry.attributes.find((a) => a.type.toLowerCase() === attr.toLowerCase());
  if (!val) return [];
  return Array.isArray(val.values) ? val.values : [val.values];
}

export async function searchUsers(config: Config): Promise<LdapUser[]> {
  return new Promise((resolve, reject) => {
    const client = ldap.createClient({
      url: config.ldap.url,
      tlsOptions: { rejectUnauthorized: config.ldap.tlsRejectUnauthorized },
      timeout: 10_000,
    });

    client.on("error", reject);

    client.bind(config.ldap.bindDN, config.ldap.bindPassword, (bindErr) => {
      if (bindErr) {
        client.destroy();
        return reject(bindErr);
      }

      const opts: ldap.SearchOptions = {
        filter: config.ldap.userFilter,
        scope: "sub",
        attributes: [
          "objectGUID",
          "sAMAccountName",
          "userPrincipalName",
          "givenName",
          "sn",
          "mail",
          "mobile",
          "telephoneNumber",
          "userAccountControl",
          "memberOf",
        ],
      };

      const users: LdapUser[] = [];

      client.search(config.ldap.baseDN, opts, (searchErr, res) => {
        if (searchErr) {
          client.destroy();
          return reject(searchErr);
        }

        res.on("searchEntry", (entry) => {
          const guidBuf = entry.attributes.find(
            (a) => a.type.toLowerCase() === "objectguid",
          );
          const guid =
            guidBuf && Buffer.isBuffer(guidBuf.values[0])
              ? bufferToGuid(guidBuf.values[0] as Buffer)
              : parseAttribute(entry, "objectGUID");

          const uac = parseInt(parseAttribute(entry, "userAccountControl") ?? "0", 10);

          users.push({
            dn: entry.dn.toString(),
            objectGUID: guid,
            sAMAccountName: parseAttribute(entry, "sAMAccountName"),
            userPrincipalName: parseAttribute(entry, "userPrincipalName"),
            givenName: parseAttribute(entry, "givenName"),
            sn: parseAttribute(entry, "sn"),
            mail: parseAttribute(entry, "mail"),
            mobile: parseAttribute(entry, "mobile"),
            telephoneNumber: parseAttribute(entry, "telephoneNumber"),
            userAccountControl: uac,
            memberOf: parseMultiAttribute(entry, "memberOf"),
          });
        });

        res.on("error", (err) => {
          client.destroy();
          reject(err);
        });

        res.on("end", () => {
          client.unbind();
          client.destroy();
          resolve(users);
        });
      });
    });
  });
}
