"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="de">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f4f4f5" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            textAlign: "center",
            padding: "2rem",
          }}
        >
          <p style={{ fontSize: "4rem", fontWeight: 700, color: "#18181b", margin: 0 }}>500</p>
          <p style={{ fontSize: "1.125rem", fontWeight: 600, color: "#18181b", margin: 0 }}>
            Kritischer Fehler
          </p>
          <p style={{ color: "#71717a", margin: 0 }}>
            Die Anwendung konnte nicht geladen werden.
          </p>
          {error.digest && (
            <p style={{ color: "#a1a1aa", fontSize: "0.75rem", margin: 0 }}>
              Fehler-ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: "0.5rem",
              padding: "0.5rem 1.25rem",
              background: "#18181b",
              color: "#fff",
              borderRadius: "0.375rem",
              border: "none",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  );
}
