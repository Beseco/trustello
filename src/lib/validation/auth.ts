import { z } from "zod";

export const registerEmployeeSchema = z.object({
  salutation: z.string().max(20).optional(),
  firstName: z.string().min(1, "Vorname ist erforderlich").max(100),
  lastName: z.string().min(1, "Nachname ist erforderlich").max(100),
  email: z.string().email("Ungültige E-Mail-Adresse").toLowerCase(),
  password: z
    .string()
    .min(8, "Passwort muss mindestens 8 Zeichen lang sein")
    .max(128, "Passwort darf maximal 128 Zeichen lang sein"),
});

export type RegisterEmployeeInput = z.infer<typeof registerEmployeeSchema>;

export const loginSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(1, "Passwort ist erforderlich"),
  totpCode: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
