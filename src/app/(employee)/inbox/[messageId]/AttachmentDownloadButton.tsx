"use client";

import { useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { getAttachmentDownloadUrl } from "@/server/actions/messages";

export function AttachmentDownloadButton({
  attachmentId,
  filename,
}: {
  attachmentId: string;
  filename: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function handleDownload() {
    setError(false);
    startTransition(async () => {
      const url = await getAttachmentDownloadUrl(attachmentId);
      if (!url) {
        setError(true);
        return;
      }
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
    });
  }

  return (
    <button
      onClick={handleDownload}
      disabled={isPending}
      title={error ? "Fehler beim Abrufen" : "Herunterladen"}
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Download className="h-3 w-3" />
      )}
      {error ? "Fehler" : "Herunterladen"}
    </button>
  );
}
