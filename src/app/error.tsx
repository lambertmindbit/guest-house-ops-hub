"use client";

import { useEffect } from "react";
import Link from "next/link";

// Route-segment error boundary: catches a render/data error in any page so the
// owner sees a recoverable screen instead of a blank crash. The error is also
// reported server-side via instrumentation's onRequestError; this logs the
// client view too (digest ties the two together).
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("client.render-error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main className="app-main">
      <div className="entrance" style={{ maxWidth: 460, marginTop: 48 }}>
        <div className="card card--pad" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
          <h1 style={{ fontSize: "var(--fs-h2)", fontWeight: 700, marginBottom: 8 }}>Something went wrong</h1>
          <p className="muted" style={{ fontSize: "var(--fs-small)", marginBottom: 18 }}>
            This screen hit an unexpected error. You can try again, or head back to Today.
          </p>
          <div className="row" style={{ gap: 8, justifyContent: "center" }}>
            <button className="btn btn--primary" onClick={reset}>Try again</button>
            <Link className="btn btn--ghost" href="/">Go to Today</Link>
          </div>
          {error.digest && (
            <p className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 16, fontFamily: "var(--font-mono, monospace)" }}>
              Reference: {error.digest}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
