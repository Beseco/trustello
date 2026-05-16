import { PinVerifyForm } from "./PinVerifyForm";
import { Mail } from "lucide-react";

export default function PinVerifyManualPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 shadow-sm">
              <Mail className="h-7 w-7 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Zugangscode eingeben</h1>
          <p className="mt-2 text-sm text-slate-500">
            Geben Sie Ihre E-Mail-Adresse und den 6-stelligen Code aus Ihrem PIN-Brief ein.
          </p>
        </div>

        {/* Formular */}
        <div className="rounded-2xl border bg-white p-8 shadow-sm">
          <PinVerifyForm />
        </div>

        {/* Alternativer Hinweis */}
        <p className="text-center text-xs text-slate-400">
          Schneller geht es per QR-Code-Scan direkt aus dem Brief.
        </p>
      </div>
    </div>
  );
}
