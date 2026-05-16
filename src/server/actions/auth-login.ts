"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export type LoginResult = { error?: string; success?: boolean };

function isNextRedirect(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const digest = (error as unknown as { digest?: string }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

export async function loginAction(data: {
  email: string;
  password: string;
  totpCode?: string;
  provider: "employee-credentials" | "reseller-credentials";
  redirectTo: string;
}): Promise<LoginResult> {
  try {
    await signIn(data.provider, {
      email: data.email,
      password: data.password,
      totpCode: data.totpCode ?? "",
      _ip: "",
      redirectTo: data.redirectTo,
    });
    return { success: true };
  } catch (error) {
    if (isNextRedirect(error)) {
      return { success: true };
    }
    if (error instanceof AuthError) {
      return { error: "Ungültige Anmeldedaten. Bitte prüfen Sie E-Mail und Passwort." };
    }
    throw error;
  }
}
