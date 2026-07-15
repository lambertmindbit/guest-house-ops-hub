# API Reference

All routes live under `src/app/api/**/route.ts`. Unless noted, every endpoint
requires the **owner session cookie** (enforced by [`src/middleware.ts`](../src/middleware.ts))
and returns the standard envelope. Two families are exempt from the cookie gate
and carry their own shared secret instead: the **token-gated webhook**
(`/api/ingest/email`, `/api/cron/sync`, `/api/ical/*`) and the **ROOT agent seam**
(`/api/agent/*`, gated by `AGENT_TOKEN` — see [Agent seam](#agent-seam-root-integration)).

```jsonc
// success
{ "data": ... }
// error
{ "error": "human-readable message" }
```

Status codes: `200`/`201` success, `404` not found, `409` conflict (overlap or
guarded delete), `422` Zod validation failure.

Inputs are validated with **Zod** at the top of each route file. Dates are
`YYYY-MM-DD`.

---

## Auth (public)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/auth/login` | Verify `OWNER_EMAIL`/`OWNER_PASSWORD`, set signed session cookie |
| `POST` | `/api/auth/logout` | Clear the session cookie |

## Reservations

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/reservations` | List reservations |
| `POST` | `/api/reservations` | Create a booking (upserts guest + inserts reservation in one transaction; returns **409** on overlap) |
| `GET` | `/api/reservations/[id]` | Fetch one |
| `PATCH` | `/api/reservations/[id]` | Edit a booking |
| `POST` | `/api/reservations/[id]/cancel` | Cancel (frees the dates) |
| `POST` | `/api/reservations/[id]/payments` | Record a payment (`isAdvance?` tags it as the advance deposit) |
| `PATCH` | `/api/reservations/[id]/stay` | `{ action: "checkin" \| "checkout" \| "undo" }` |
| `DELETE` | `/api/payments/[id]` | Delete a payment |

`POST`/`PATCH` accept an optional `advanceRequired` (the deposit the booking
expects); advance status is **derived** at render time from advance-tagged
payments vs that figure — never stored as a paid/unpaid flag. The Bookings list
page (`/reservations`) renders server-side via Prisma and does its search (guest,
phone, room or channel) and stay-state filtering client-side.

## Availability & dashboard

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/availability` | Derived nightly availability for a room type / range |
| `GET` | `/api/dashboard/today` | Today-board summary (check-ins/outs, in-house, occupancy) |

## Rooms, room types, channels (admin)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/rooms` | List rooms (`?includeArchived=1` to include retired) |
| `GET` | `/api/rooms/available` | Which physical rooms are free for a whole stay — `?checkIn&checkOut[&exclude]` → `[{ id, label, roomTypeName, free }]` (drives the reservation form's room picker; availability stays derived) |
| `POST` | `/api/rooms` | Create a room |
| `PATCH` | `/api/rooms/[id]` | Edit / archive / housekeeping flag (`{ label?, roomTypeId?, archived?, markCleaned? }`) |
| `DELETE` | `/api/rooms/[id]` | Delete — **409** unless the room has zero history (else archive) |
| `GET` / `POST` | `/api/room-types` | List / create room types (base/floor/ceiling rates) |
| `PATCH` / `DELETE` | `/api/room-types/[id]` | Edit / delete (409 if it still has rooms) |
| `GET` / `POST` | `/api/channels` | List / create channels |
| `PATCH` / `DELETE` | `/api/channels/[id]` | Edit / delete (409 if it has bookings) |
| `GET` / `PATCH` | `/api/settings` | Property profile (single row, get-or-create) |

## Properties, access & session (multi-property)

One owner can run several guest houses in one database (see
[ARCHITECTURE.md → Multiple properties](ARCHITECTURE.md#multiple-properties-one-owner)).
These manage that; on a single-property client they're inert.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` / `POST` | `/api/properties` | List the owner's properties / **create** one (owner or platform-admin) — seeds its channels (Direct / Phone / WhatsApp / Website / Travel agent) and grants the creator |
| `POST` | `/api/session/property` | Switch the acting property (`{ propertyId }`) — re-stamps the tenant header so the whole app re-scopes |
| `PUT` | `/api/users/[id]/properties` | Set a login's full property-access set (replaces `UserProperty` rows; keeps the user's home property in the set) |

## Maintenance blocks

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/blocks` | List blocks (optional `from`/`to`) |
| `POST` | `/api/blocks` | Hold a room out of service (`roomId`, `startDate`, `endDate`, `reason`) |
| `DELETE` | `/api/blocks/[id]` | Remove a block (**manual** blocks only; iCal blocks are managed by their feed) |

## Pricing (advisory)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/pricing/quote` | Suggested nightly rates + total for `roomId` + `checkIn`/`checkOut` |
| `GET` / `PATCH` | `/api/pricing/policy` | The single pricing policy (weekend / lead-time / occupancy rules) |
| `POST` / `DELETE` | `/api/pricing/overrides` | Pin / clear a manual nightly rate for a room type on a date |
| `GET` / `POST` | `/api/seasons` | List / create season (date range + adjustment) |
| `PATCH` / `DELETE` | `/api/seasons/[id]` | Edit / delete a season |

## Guests

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/guests` | List / search guests (`?q=` name or phone) |
| `POST` | `/api/guests` | Create a guest directly (name, phone, email?, notes?, blacklist?). **409** if the phone already exists |
| `PATCH` | `/api/guests/[id]` | Edit profile (email, ID, notes, blacklist, **C-Form** fields) |
| `POST` | `/api/guests/[id]/id-document` | Upload/replace a scanned ID (multipart `file`; JPG/PNG/WEBP/PDF ≤ 5 MB). **503** if storage isn't configured |
| `GET` | `/api/guests/[id]/id-document` | Short-lived signed URL to view the stored document |
| `DELETE` | `/api/guests/[id]/id-document` | Remove the stored document |

> Guests carry optional **C-Form** fields for foreign-national registration
> (Registration of Foreigners Rules, 1992): nationality, passport (number /
> issue date+place / expiry), visa (number / type / issue date+place / expiry),
> port + date of entry into India, purpose of visit. All nullable; create/update
> accept them and the guest profile surfaces them in a collapsible section.

## Scam / flagged numbers (safety)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/flagged-numbers` | List flagged numbers, or `?check=<phone>` → `{ flagged, reason }` quick-lookup |
| `POST` | `/api/flagged-numbers` | Add a phone to the list (`phone`, `reason?`). **409** if already listed |
| `DELETE` | `/api/flagged-numbers/[id]` | Remove a number |

> The booking form and guest detail page check the list and show a warning when a
> phone is known-bad; the list is managed at **Settings → Scam numbers**.

## Escalations (HITL queue)

The human-in-the-loop inbox ROOT agents file into. See
[INTEGRATION.md](INTEGRATION.md) for the full agent contract.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/escalations` | owner | List the queue (filter by status/severity) |
| `POST` | `/api/escalations` | owner | File an escalation manually |
| `GET` | `/api/escalations/[id]` | owner | Fetch one |
| `PATCH` | `/api/escalations/[id]` | owner | Triage (status transition, assignee, notes) |

## Messaging outbox

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/messages` | List logged outbound messages (`?guestId`, `?reservationId`, `?limit`) |

> Messages are written through a **LogAdapter** ([`src/lib/messaging.ts`](../src/lib/messaging.ts))
> that records `status=logged` today (no provider wired). When WhatsApp/SMS/email
> is configured later, the adapter sends and flips the status — callers don't change.
> Agents queue messages via the [agent seam](#agent-seam-root-integration).

## Agent seam (ROOT integration)

Token-gated endpoints the ROOT AI agents call. **Excluded** from the owner-cookie
middleware; each requires the shared secret in `x-agent-token` (or
`Authorization: Bearer …`), compared in constant time against `AGENT_TOKEN`. The
routes **fail closed** (401) if `AGENT_TOKEN` is unset, so the seam stays dark
until the agents are ready. All accept an optional forward-compatible `propertyRef`
(ignored today).

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/agent/escalations` | File a HITL escalation (idempotent on `externalId`; **200** `deduped:true` on repeat). See [INTEGRATION.md](INTEGRATION.md) |
| `GET` | `/api/agent/availability` | Derived availability for `roomTypeId` + `checkIn`/`checkOut` |
| `GET` | `/api/agent/rooms` | Read-only room catalog (id, label, type, capacity, base rate) — the PMS truth ROOT grounds its cards/id-mapping on |
| `GET` | `/api/agent/rooms/availability` | Per-**room** free/busy for `checkIn`/`checkOut` (optional comma-separated `roomIds`); wraps the same derived query as the owner form |
| `GET` | `/api/agent/quote` | Suggested price for `roomId` + `checkIn`/`checkOut` (reuses the advisory pricing engine) |
| `POST` | `/api/agent/reservations` | Create a booking — same guest-upsert + transaction path as the owner route, so the GiST overlap constraint governs (**409** on overlap) |
| `POST` | `/api/agent/messages` | Queue an outbound message via the LogAdapter (returns **201** with the id + `status:"logged"`) |
| `GET` | `/api/agent/faq` | Active FAQ entries (question / answer / category + optional photo/map `media`) the guest assistant answers from |
| `GET` | `/api/agent/policies` | Owner-authored assistant policies — the agent injects these into its prompt each turn (edits apply within ~1 min, no redeploy) |
| `POST` | `/api/agent/turns` | Per-turn diagnostics (tools used, token count, fallback-model flag) appended to the owner chat log |
| `GET`/`POST` | `/api/agent/owner/*` | Owner-console agent tools — daily summary, open requests, blocks, escalation actions, finance |

> Agents never get direct write access to money or bookings beyond this seam. The
> booking route runs the **same** `tx.reservation.create` as the owner path — the
> no-double-booking core still governs every write. Sensitive actions (e.g.
> cancelling) are filed as escalations for a human to commit, never performed by
> the agent.

## Inbound bookings (OTA email ingestion)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/inbound` | owner | List pending parsed bookings awaiting review |
| `POST` | `/api/inbound` | owner | Paste a raw confirmation email → parse + stage it (Inbox screen) |
| `PATCH` | `/api/inbound/[id]` | owner | Mark a staged item `imported` (with `reservationId`) or `dismissed` |
| `POST` | `/api/ingest/email` | **`INGEST_TOKEN`** | Webhook entry for automated ingestion (inbox/forwarding rule). Excluded from the owner-cookie middleware; gated by its own token. The review/import step is unchanged. |

> The Inbox review screen corrects parsed fields and creates the booking through
> the existing `POST /api/reservations` (so it gets conflict-checking for free),
> then `PATCH`es the inbound item to `imported`.

## Finance / expenses / export

| Method | Path | Purpose |
|--------|------|---------|
| `GET` / `POST` | `/api/expenses` | List (optional `from`/`to`) / create an expense |
| `DELETE` | `/api/expenses/[id]` | Delete an expense |
| `GET` | `/api/export/reservations.csv` | Download bookings CSV (optional `from`/`to`) |
| `GET` | `/api/export/payments.csv` | Download payments CSV (optional `from`/`to`) |
| `GET` | `/api/analytics/export` | Download the Analytics view as CSV — summary metrics + source mix + occupancy by room type + daily occupancy (optional `from`/`to`) |

## iCal feeds & sync

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` / `POST` | `/api/feeds` | owner | List / add an external iCal feed for a room |
| `PATCH` / `DELETE` | `/api/feeds/[id]` | owner | Toggle active / remove a feed (and its imported blocks) |
| `POST` | `/api/sync` | owner | Manually run the iCal import now |
| `GET` | `/api/ical/[token]/[room]` | **token** | Public `.ics` export of a room's busy dates (for OTAs). Guarded by `ICAL_FEED_TOKEN` |
| `GET` | `/api/cron/sync` | **`CRON_SECRET`** | Daily import, invoked by Vercel Cron (02:00 UTC). Bearer-secret gated |

> The token/secret-gated routes (`/api/ical/*`, `/api/cron/sync`,
> `/api/ingest/email`, and the whole `/api/agent/*` seam) are excluded from the
> owner-cookie middleware because they must be reachable without a login — they
> carry their own shared-secret checks.
