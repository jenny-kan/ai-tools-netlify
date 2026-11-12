"use client";

/**
 * Root-level error boundary — fires when the ROOT LAYOUT itself throws
 * (error.tsx can't catch that). Renders its own <html>/<body> because the
 * layout never mounted.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#fff",
          color: "#0a0a0a",
        }}
      >
        <div style={{ maxWidth: "28rem", padding: "2rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
            The site hit a fatal error
          </h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#666", lineHeight: 1.6 }}>
            The page couldn&apos;t be rendered at all. {error.digest ? `Reference: ${error.digest}.` : ""}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid #ddd",
              background: "#0a0a0a",
              color: "#fff",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
