import cron from "node-cron";
import { loadConfig } from "./config.js";
import { runSync } from "./sync.js";

const configPath = process.env.CONFIG_PATH ?? "config.yaml";
const config = loadConfig(configPath);

console.log(
  `[ad-sync] Konfiguration geladen — Sync alle ${config.sync.intervalMinutes} Minuten` +
    (config.sync.dryRun ? " (DRY RUN)" : ""),
);

// Sofort beim Start einmal ausführen
void runSync(config).catch((err: unknown) => {
  console.error("[ad-sync] Initialer Sync fehlgeschlagen:", err);
});

// Danach im Cron-Interval
const cronExpression = `*/${config.sync.intervalMinutes} * * * *`;
cron.schedule(cronExpression, () => {
  void runSync(config).catch((err: unknown) => {
    console.error("[ad-sync] Sync fehlgeschlagen:", err);
  });
});

console.log(`[ad-sync] Scheduler aktiv: ${cronExpression}`);
