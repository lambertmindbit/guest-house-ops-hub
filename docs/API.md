# API Reference

All routes live under `src/app/api/**/route.ts`. Unless noted, every endpoint
requires the **owner session cookie** (enforced by [`src/middleware.ts`](../src/middleware.ts))
and returns the standard envelope:

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
| `POST` | `/api/reservations/[id]/payments` | Record a payment |
| `PATCH` | `/api/reservations/[id]/stay` | `{ action: "checkin" \| "checkout" \| "undo" }` |
| `DELETE` | `/api/payments/[id]` | Delete a payment |

## Availability & dashboard

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/availability` | Derived nightly availability for a room type / range |
| `GET` | `/api/dashboard/today` | Today-board summary (check-ins/outs, in-house, occupancy) |

## Rooms, room types, channels (admin)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/rooms` | List rooms (`?includeArchived=1` to include retired) |
| `POST` | `/api/rooms` | Create a room |
| `PATCH` | `/api/rooms/[id]` | Edit / archive / housekeeping flag (`{ label?, roomTypeId?, archived?, markCleaned? }`) |
| `DELETE` | `/api/rooms/[id]` | Delete — **409** unless the room has zero history (else archive) |
| `GET` / `POST` | `/api/room-types` | List / create room types (base/floor/ceiling rates) |
| `PATCH` / `DELETE` | `/api/room-types/[id]` | Edit / delete (409 if it still has rooms) |
| `GET` / `POST` | `/api/channels` | List / create channels |
| `PATCH` / `DELETE` | `/api/channels/[id]` | Edit / delete (409 if it has bookings) |
| `GET` / `PATCH` | `/api/settings` | Property profile (single row, get-or-create) |

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
| `DELETE` | `/api/seasons/[id]` | Delete a season |

## Guests

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/guests` | List / search guests (`?q=` name or phone) |
| `PATCH` | `/api/guests/[id]` | Edit profile (email, ID, notes, blacklist) |

## Finance / expenses / export

| Method | Path | Purpose |
|--------|------|---------|
| `GET` / `POST` | `/api/expenses` | List (optional `from`/`to`) / create an expense |
| `DELETE` | `/api/expenses/[id]` | Delete an expense |
| `GET` | `/api/export/reservations.csv` | Download bookings CSV (optional `from`/`to`) |
| `GET` | `/api/export/payments.csv` | Download payments CSV (optional `from`/`to`) |

## iCal feeds & sync

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` / `POST` | `/api/feeds` | owner | List / add an external iCal feed for a room |
| `PATCH` / `DELETE` | `/api/feeds/[id]` | owner | Toggle active / remove a feed (and its imported blocks) |
| `POST` | `/api/sync` | owner | Manually run the iCal import now |
| `GET` | `/api/ical/[token]/[room]` | **token** | Public `.ics` export of a room's busy dates (for OTAs). Guarded by `ICAL_FEED_TOKEN` |
| `GET` | `/api/cron/sync` | **`CRON_SECRET`** | Daily import, invoked by Vercel Cron (02:00 UTC). Bearer-secret gated |

> The three token/secret-gated routes (`/api/ical/*`, `/api/cron/sync`) are
> excluded from the owner-cookie middleware because they must be reachable without
> a login — they carry their own shared-secret checks.
