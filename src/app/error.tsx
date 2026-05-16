"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
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
        fontFamily: "system-ui, sans-serif",
        background: "#f4f4f5",
      }}
    >
      <p style={{ fontSize: "4rem", fontWeight: 700, color: "#18181b", margin: 0 }}>500</p>
      <p style={{ fontSize: "1.125rem", fontWeight: 600, color: "#18181b", margin: 0 }}>
        Ein Fehler ist aufgetreten
      </p>
      <p style={{ color: "#71717a", margin: 0 }}>
        Bitte versuchen Sie es erneut oder wenden Sie sich an den Support.
      </p>
      {error.digest && (
        <p style={{ color: "#a1a1aa", fontSize: "0.75rem", margin: 0 }}>
          Fehler-ID: {error.digest}
        </p>
      )}
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
        <button
          onClick={reset}
          style={{
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
        <Link
          href="/inbox"
          style={{
            padding: "0.5rem 1.25rem",
            background: "transparent",
            color: "#18181b",
            borderRadius: "0.375rem",
            border: "1px solid #d4d4d8",
            textDecoration: "none",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}
