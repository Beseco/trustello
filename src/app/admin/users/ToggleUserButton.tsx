"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toggleUserActive } from "@/server/actions/admin-users";
import { toast } from "sonner";

export function ToggleUserButton({
  userId,
  isActive,
  isSelf,
}: {
  userId: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (isSelf) return null;

  function handleClick() {
    startTransition(async () => {
      const result = await toggleUserActive(userId, !isActive);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isActive ? "Benutzer deaktiviert" : "Benutzer aktiviert");
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
        isActive
          ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
          : "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
      }`}
    >
      {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
      {isActive ? "Deaktivieren" : "Aktivieren"}
    </button>
  );
}
