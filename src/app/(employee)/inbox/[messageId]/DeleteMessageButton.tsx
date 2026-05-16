"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { deleteMessage } from "@/server/actions/messages";
import { toast } from "sonner";

export function DeleteMessageButton({
  messageId,
  variant = "button",
}: {
  messageId: string;
  variant?: "button" | "text";
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!confirm("Nachricht wirklich archivieren? Sie wird aus der Ansicht entfernt.")) return;
    startTransition(async () => {
      const result = await deleteMessage(messageId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Nachricht archiviert");
        router.push("/inbox");
      }
    });
  }

  if (variant === "text") {
    return (
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        Archivieren
      </button>
    );
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
    >
      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      Archivieren
    </button>
  );
}
