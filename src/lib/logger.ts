import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "password",
      "passwordHash",
      "totpSecret",
      "*.password",
      "*.passwordHash",
      "*.totpSecret",
      "masterKey",
      "MASTER_KEY",
      "tenantMasterKey",
      "*.tenantMasterKey",
      "messageKey",
      "*.messageKey",
      "token",
      "secret",
      "*.secret",
    ],
    censor: "[REDACTED]",
  },
  ...(process.env.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  }),
});
