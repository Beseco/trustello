import { prisma } from "@/lib/db";
import { RegisterForm } from "./RegisterForm";

type Props = { searchParams: Promise<{ token?: string }> };

export default async function RegistrierenPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-sm text-center">
          <p className="text-lg font-semibold text-slate-900">Kein Einladungslink</p>
          <p className="mt-2 text-sm text-slate-500">
            Sie benötigen einen Einladungslink aus einer E-Mail, um ein Konto zu erstellen.
          </p>
        </div>
      </div>
    );
  }

  const invite = await prisma.citizenInviteToken.findUnique({ where: { token } });

  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-sm text-center">
          <p className="text-lg font-semibold text-slate-900">Link abgelaufen</p>
          <p className="mt-2 text-sm text-slate-500">
            Dieser Einladungslink ist nicht mehr gültig. Bitte fordern Sie beim Absender einen neuen Link an.
          </p>
        </div>
      </div>
    );
  }

  const customer = await prisma.customer.findUnique({
    where: { id: invite.customerId },
    select: { firstName: true, lastName: true },
  });

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">Postfach einrichten</h1>
          {customer && (
            <p className="mt-1 text-sm text-slate-500">
              Willkommen, {customer.firstName} {customer.lastName}! Setzen Sie Ihr Passwort.
            </p>
          )}
          <p className="mt-2 text-xs text-slate-400">
            Konto für: <span className="font-medium text-slate-600">{invite.email}</span>
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <RegisterForm token={token} email={invite.email} />
        </div>
        <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <strong>Nach der Registrierung empfehlen wir:</strong> Richten Sie ein Tresor-Passwort ein,
          damit Ihre Nachrichten Ende-zu-Ende verschlüsselt sind — nur Sie können sie lesen.
        </div>
      </div>
    </div>
  );
}
