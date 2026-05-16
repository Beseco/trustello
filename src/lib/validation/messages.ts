import { z } from "zod";

export const sendMessageSchema = z.object({
  recipientId: z.string().min(1, "Empfänger erforderlich"),
  subject: z.string().min(1, "Betreff darf nicht leer sein").max(200, "Betreff zu lang (max. 200 Zeichen)"),
  body: z.string().min(1, "Nachrichtentext darf nicht leer sein").max(50000, "Nachricht zu lang"),
  securityLevel: z.enum(["LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4"]),
  minTrustLevel: z.enum(["NONE", "EMAIL", "SMS", "PIN_LETTER", "BAYERN_ID_S", "BAYERN_ID_H", "EID"]),
  allowReply: z.boolean(),
  encryptSubject: z.boolean(),
  // LEVEL_3/4: Passwortschutz
  password: z.string().optional(),
  passwordHint: z.string().max(200).optional(),
  // Sender-Metadaten
  ouId: z.string().optional(),
  senderIsAnonymous: z.boolean().default(false),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
