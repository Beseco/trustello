"use client";

import { useState, useMemo } from "react";
import { X } from "lucide-react";
import sanitizeHtml from "sanitize-html";

export function LegalFooter({
  imprintHtml,
  privacyPolicyHtml,
}: {
  imprintHtml?: string | null;
  privacyPolicyHtml?: string | null;
}) {
  const [modal, setModal] = useState<"imprint" | "privacy" | null>(null);

  // Sanitize admin-supplied HTML — verhindert Stored XSS im Bürger-Portal
  // Hooks MÜSSEN vor dem Early Return stehen (Rules of Hooks)
  const safeImprint = useMemo(
    () =>
      sanitizeHtml(imprintHtml ?? "", {
        allowedTags: sanitizeHtml.defaults.allowedTags,
        allowedAttributes: sanitizeHtml.defaults.allowedAttributes,
      }),
    [imprintHtml],
  );
  const safePrivacy = useMemo(
    () =>
      sanitizeHtml(privacyPolicyHtml ?? "", {
        allowedTags: sanitizeHtml.defaults.allowedTags,
        allowedAttributes: sanitizeHtml.defaults.allowedAttributes,
      }),
    [privacyPolicyHtml],
  );

  if (!imprintHtml && !privacyPolicyHtml) return null;

  const content = modal === "imprint" ? safeImprint : safePrivacy;
  const title = modal === "imprint" ? "Impressum" : "Datenschutzerklärung";

  return (
    <>
      <div className="flex justify-center gap-4 text-xs text-muted-foreground">
        {imprintHtml && (
          <button
            onClick={() => setModal("imprint")}
            className="underline underline-offset-4 hover:text-foreground"
          >
            Impressum
          </button>
        )}
        {privacyPolicyHtml && (
          <button
            onClick={() => setModal("privacy")}
            className="underline underline-offset-4 hover:text-foreground"
          >
            Datenschutz
          </button>
        )}
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setModal(null)}
        >
          <div
            className="relative max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{title}</h2>
              <button
                onClick={() => setModal(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: content ?? "" }}
            />
          </div>
        </div>
      )}
    </>
  );
}
