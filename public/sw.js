// Hand-written service worker (no dependency). Two jobs:
//   1. Offline SHELL — static hashed assets are cache-first (immutable),
//      navigations are network-first with an offline fallback, and API/dynamic
//      data is NEVER cached (so bookings are never shown stale).
//   2. Offline WRITE QUEUE — state-changing API calls made while offline are
//      stored in IndexedDB and replayed through the live network on reconnect, so
//      the server stays authoritative (each replay still hits the 409 guard).
//      Classification rules mirror src/lib/offline-queue.ts (the tested spec).

const CACHE = "ops-shell-v2";
const PRECACHE = ["/offline.html", "/manifest.webmanifest", "/icons/icon-192.png"];

const DB_NAME = "ota-offline";
const STORE = "queue";

// ── IndexedDB queue helpers ─────────────────────────────────────────────────
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function queueAdd(entry) {
  const db = await openDb();
  await new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}
async function queueAll() {
  const db = await openDb();
  return new Promise((res, rej) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
}
async function queueDelete(id) {
  const db = await openDb();
  await new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

// Mirrors isQueueableRequest in src/lib/offline-queue.ts.
function isQueueable(method, pathname) {
  const m = method.toUpperCase();
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(m)) return false;
  if (!pathname.startsWith("/api/")) return false;
  return !["/api/auth", "/api/agent", "/api/ingest", "/api/cron"].some((p) => pathname.startsWith(p));
}
// Mirrors classifyReplay in src/lib/offline-queue.ts.
function classify(status) {
  if (status >= 200 && status < 300) return "applied";
  if (status === 409) return "conflict";
  if (status >= 400 && status < 500) return "failed";
  return "retry";
}

async function broadcast(msg) {
  const clients = await self.clients.matchAll();
  for (const c of clients) c.postMessage(msg);
}

// Replay queued writes oldest-first. Applied/conflict/failed are removed;
// retryable (5xx / still offline) stay. Conflicts are surfaced to the UI.
async function replayQueue() {
  const entries = (await queueAll()).sort((a, b) => a.enqueuedAt - b.enqueuedAt);
  const conflicts = [];
  for (const e of entries) {
    let status = 0;
    try {
      const res = await fetch(e.url, { method: e.method, headers: e.headers, body: e.body ?? undefined });
      status = res.status;
    } catch {
      status = 0; // still offline
    }
    const outcome = classify(status);
    if (outcome === "retry") break; // stop; try again on the next reconnect
    await queueDelete(e.id);
    if (outcome === "conflict" || outcome === "failed") conflicts.push({ url: e.url, method: e.method, outcome });
  }
  const remaining = (await queueAll()).length;
  await broadcast({ type: "offline-queue", pending: remaining, conflicts });
  return remaining;
}

// ── Lifecycle ───────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "replay") event.waitUntil(replayQueue());
  if (data.type === "count") event.waitUntil(queueAll().then((q) => broadcast({ type: "offline-queue", pending: q.length, conflicts: [] })));
});

// Background Sync (where supported) replays without needing the page open.
self.addEventListener("sync", (event) => {
  if (event.tag === "ota-replay") event.waitUntil(replayQueue());
});

// ── Web Push (owner notifications) ──────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || "Guest House Ops";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || undefined,
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) { c.navigate(target); return c.focus(); }
      }
      return self.clients.openWindow(target);
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Queue state-changing API writes made while offline.
  if (req.method !== "GET" && isQueueable(req.method, url.pathname)) {
    event.respondWith(
      fetch(req.clone()).catch(async () => {
        const body = await req.clone().text().catch(() => null);
        const headers = {};
        for (const [k, v] of req.headers.entries()) headers[k] = v;
        const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, url: req.url, method: req.method, headers, body: body || null, enqueuedAt: Date.now() };
        await queueAdd(entry);
        const remaining = (await queueAll()).length;
        await broadcast({ type: "offline-queue", pending: remaining, conflicts: [] });
        return new Response(JSON.stringify({ data: { queued: true } }), { status: 202, headers: { "content-type": "application/json" } });
      }),
    );
    return;
  }
  if (req.method !== "GET") return;

  // Immutable, content-hashed assets → cache-first. Skipped on localhost: dev
  // chunks share stable URLs across rebuilds, so caching them serves stale code.
  const isDev = self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";
  if (!isDev && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"))) {
    event.respondWith(
      caches.match(req).then((hit) =>
        hit ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        }),
      ),
    );
    return;
  }

  // Page navigations → network-first, fall back to the offline page.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
  }
  // Everything else (API reads) falls through to the network untouched.
});
