"use client";

import { useEffect } from "react";

// Last-resort boundary: catches errors thrown in the ROOT layout itself (which
// error.tsx can't, since it renders inside the layout). It must supply its own
// <html>/<body>. Kept dependency-free and inline-styled so it works even if the
// app's CSS never loaded.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("client.global-error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", background: "#f2f2f7", color: "#1c1c1e" }}>
        <div style={{ maxWidth: 420, margin: "64px auto", padding: "0 20px", textAlign: "center" }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>⚠️</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>The app hit an error</h1>
          <p style={{ fontSize: 14, color: "#6b6b70", margin: "0 0 20px", lineHeight: 1.5 }}>
            Please try again. If it keeps happening, reload the page.
          </p>
          <button
            onClick={reset}
            style={{ border: "none", background: "#0a84ff", color: "#fff", padding: "10px 18px", borderRadius: 10, fontSize: 15, fontWeight: 600 }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ fontSize: 11, color: "#9a9aa0", marginTop: 18, fontFamily: "monospace" }}>Reference: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
