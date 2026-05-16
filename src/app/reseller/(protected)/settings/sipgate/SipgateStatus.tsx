import { getSipgateAccountInfo } from "@/lib/sms/sipgate";
import { CheckCircle2, XCircle, AlertCircle, HelpCircle, Wifi } from "lucide-react";

type Props = {
  resellerId: string;
};

export async function SipgateStatus({ resellerId }: Props) {
  const info = await getSipgateAccountInfo(resellerId);

  const statusConfig = {
    ok: {
      icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
      dot: "bg-green-500",
      label: "Verbunden",
      labelColor: "text-green-700",
      bg: "bg-green-50 border-green-200",
    },
    auth_error: {
      icon: <XCircle className="h-4 w-4 text-red-600" />,
      dot: "bg-red-500",
      label: "Authentifizierungsfehler",
      labelColor: "text-red-700",
      bg: "bg-red-50 border-red-200",
    },
    error: {
      icon: <AlertCircle className="h-4 w-4 text-amber-600" />,
      dot: "bg-amber-500",
      label: "Verbindungsfehler",
      labelColor: "text-amber-700",
      bg: "bg-amber-50 border-amber-200",
    },
    unconfigured: {
      icon: <HelpCircle className="h-4 w-4 text-slate-400" />,
      dot: "bg-slate-400",
      label: "Nicht konfiguriert",
      labelColor: "text-slate-600",
      bg: "bg-slate-50 border-slate-200",
    },
  }[info.status];

  return (
    <div className={`rounded-lg border p-4 ${statusConfig.bg}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            {info.status === "ok" && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            )}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${statusConfig.dot}`} />
          </span>
          <div>
            <p className={`text-sm font-medium ${statusConfig.labelColor}`}>{statusConfig.label}</p>
            {info.error && (
              <p className="mt-0.5 text-xs text-red-600">{info.error}</p>
            )}
          </div>
        </div>

        {info.status === "ok" && info.balance && (
          <div className="text-right">
            <p className="text-xs text-slate-500">Guthaben</p>
            <p className="text-sm font-semibold text-slate-800">
              {new Intl.NumberFormat("de-DE", {
                style: "currency",
                currency: info.balance.currency,
              }).format(info.balance.amount)}
            </p>
          </div>
        )}
      </div>

      {info.status === "ok" && info.smsDevices && info.smsDevices.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {info.smsDevices.map((device) => (
            <span
              key={device.id}
              className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200"
            >
              <Wifi className="h-3 w-3" />
              {device.alias} <span className="text-slate-400">({device.smsId})</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
