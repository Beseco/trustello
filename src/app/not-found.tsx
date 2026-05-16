import Link from "next/link";

export default function NotFound() {
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
          <p style={{ fontSize: "4rem", fontWeight: 700, color: "#18181b", margin: 0 }}>404</p>
          <p style={{ fontSize: "1.125rem", fontWeight: 600, color: "#18181b", margin: 0 }}>
            Seite nicht gefunden
          </p>
          <p style={{ color: "#71717a", margin: 0 }}>
            Die angeforderte Seite existiert nicht oder wurde verschoben.
          </p>
          <Link
            href="/inbox"
            style={{
              marginTop: "0.5rem",
              padding: "0.5rem 1.25rem",
              background: "#18181b",
              color: "#fff",
              borderRadius: "0.375rem",
              textDecoration: "none",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            Zur Startseite
          </Link>
        </div>
      </body>
    </html>
  );
}
