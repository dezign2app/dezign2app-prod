"use client";

// Force dynamic so Next.js doesn't try to statically pre-render this error
// boundary during `next build` — it needs a runtime context to work.
export const dynamic = "force-dynamic";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#0d1117",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          color: "#e6edf3",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#8b949e", marginBottom: "2rem" }}>
            {error?.message ?? "An unexpected error occurred."}
          </p>
          <button
            onClick={reset}
            style={{
              background: "#238636",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              padding: "0.6rem 1.4rem",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
