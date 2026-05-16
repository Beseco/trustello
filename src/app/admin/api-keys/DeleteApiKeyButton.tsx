"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteApiKey } from "@/server/actions/api-keys";
import { toast } from "sonner";

export function DeleteApiKeyButton({ keyId }: { keyId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("API-Key wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.")) return;
    startTransition(async () => {
      const result = await deleteApiKey(keyId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("API-Key gelöscht");
      }
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="inline-flex items-center gap-1 rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
      title="Löschen"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
