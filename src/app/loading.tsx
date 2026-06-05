// Shown instantly on every navigation while the destination page renders on the
// server. Without this, the browser stays frozen on the previous page until the
// new one is fully fetched — making module-to-module navigation feel slow even
// when the render is quick. Next.js swaps this out the moment the page is ready.
export default function Loading() {
  return (
    <main className="app-main" aria-busy="true">
      <style>{"@keyframes ops-spin{to{transform:rotate(360deg)}}"}</style>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          minHeight: "60vh",
          color: "var(--text-muted)",
        }}
      >
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            border: "2.5px solid var(--surface-3)",
            borderTopColor: "var(--accent)",
            animation: "ops-spin 0.7s linear infinite",
          }}
        />
        <span style={{ fontSize: "var(--fs-meta)" }}>Loading…</span>
      </div>
    </main>
  );
}
