import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";

const GroupMappingSchema = z.record(z.string(), z.string());

const ConfigSchema = z.object({
  trustello: z.object({
    apiUrl: z.string().url(),
    apiKey: z.string().min(1),
  }),
  ldap: z.object({
    url: z.string().url(),
    bindDN: z.string().min(1),
    bindPassword: z.string().min(1),
    baseDN: z.string().min(1),
    userFilter: z.string().default("(objectClass=user)"),
    tlsRejectUnauthorized: z.boolean().default(true),
  }),
  sync: z.object({
    intervalMinutes: z.number().int().min(1).default(15),
    dryRun: z.boolean().default(false),
    defaultRole: z
      .enum(["EMPLOYEE", "CUSTOMER_MANAGER", "USER_MANAGER", "TENANT_ADMIN"])
      .default("EMPLOYEE"),
    groupToOuMapping: GroupMappingSchema.optional(),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(path = "config.yaml"): Config {
  const raw = readFileSync(path, "utf-8");
  const parsed = parse(raw) as unknown;
  return ConfigSchema.parse(parsed);
}
