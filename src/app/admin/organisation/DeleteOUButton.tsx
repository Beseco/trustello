"use client";

import { useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { deleteOU } from "@/server/actions/organisation";
import { toast } from "sonner";

export function DeleteOUButton({ ouId, hasChildren, hasMembers }: { ouId: string; hasChildren: boolean; hasMembers: boolean }) {
  const [isPending, startTransition] = useTransition();
  const disabled = hasChildren || hasMembers;

  function handleClick() {
    if (!confirm("Organisationseinheit wirklich löschen?")) return;
    startTransition(async () => {
      const result = await deleteOU(ouId);
      if (result.error) toast.error(result.error);
      else toast.success("Einheit gelöscht");
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending || disabled}
      title={disabled ? "Einheit hat noch Untereinheiten oder Mitglieder" : "Löschen"}
      className="inline-flex items-center rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-30"
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}
