<!-- refreshed: 2026-06-01 -->
# Structure

**Analysis Date:** 2026-06-01

## Directory Layout

```text
OTA/
├── src/
│   ├── app/                    # Next.js App Router: pages + API route handlers
│   │   ├── api/                # Route handlers (server-only, { data } / { error })
│   │   ├── <feature>/page.tsx  # Server-component pages (one dir per screen)
│   │   ├── layout.tsx          # Root layout (NavBar, metadata, PWA manifest)
│   │   ├── globals.css         # Tailwind v4 entry (@import "tailwindcss")
│   │   └── page.tsx            # "/" Today dashboard
│   ├── components/             # "use client" widgets (forms, buttons, panels)
│   ├── lib/                    # Domain logic + shared helpers (framework-light)
│   └── middleware.ts           # Auth gate (HMAC cookie) for all non-public routes
├── prisma/
│   ├── schema.prisma           # Models + enums (snake_case @map to SQL)
│   ├── migrations/             # Hand-edited SQL migrations (raw GiST/daterange)
│   └── seed.mjs                # Idempotent seed (rooms, room types, 5 channels)
├── tests/                      # Vitest integration tests (hit real Postgres)
├── public/                     # PWA manifest + generated icons
│   ├── manifest.webmanifest
│   └── icons/                  # icon-192/512, maskable, apple-touch (generated)
├── scripts/
│   └── generate-icons.mjs      # Dependency-free PNG icon generator
├── .planning/codebase/         # This codebase map
├── CLAUDE.md                   # Project + Karpathy coding guidelines
├── vercel.json                 # Daily Cron (/api/cron/sync at 02:00 UTC)
├── docker-compose.yml          # Local Postgres parity (dev uses Supabase)
├── next.config.mjs             # serverExternalPackages: ["node-ical"]
├── vitest.config.ts            # node env, serial, @/ alias, dotenv/config
└── .env.example                # Documented placeholders (.env is git-ignored)
```

## Key Locations

| Concern | Location |
|---|---|
| Page screens (RSC) | `src/app/<feature>/page.tsx` |
| API endpoints | `src/app/api/**/route.ts` |
| Client widgets | `src/components/*.tsx` |
| Domain logic | `src/lib/*.ts` |
| Prisma client singleton | `src/lib/prisma.ts` |
| Availability (derived) | `src/lib/availability.ts` |
| Reservation writes + overlap mapping | `src/lib/reservations.ts`, `src/lib/db-errors.ts` |
| Calendar grid builder | `src/lib/calendar.ts` |
| Dashboard / conflicts / housekeeping | `src/lib/dashboard.ts`, `conflicts.ts`, `housekeeping.ts` |
| Finance / analytics | `src/lib/finance.ts`, `src/lib/analytics.ts` |
| iCal export / import | `src/lib/ical.ts`, `src/lib/ical-import.ts` |
| Auth (sign/verify cookie) | `src/lib/auth.ts` + `src/middleware.ts` |
| Date + money + response helpers | `src/lib/dates.ts`, `src/lib/format.ts`, `src/lib/api.ts` |
| DB schema + correctness core | `prisma/schema.prisma`, `prisma/migrations/*_init/migration.sql` |

## Routes (App Router)

**Pages (server components):**
`/` (dashboard) · `/calendar` · `/guests` · `/housekeeping` · `/finance` · `/analytics` · `/conflicts` · `/feeds` · `/login` · `/reservations/new` · `/reservations/[id]` · `/reservations/[id]/edit`

**API route handlers** (`src/app/api/`):
- Reservations: `reservations/route.ts` (POST/GET), `reservations/[id]/route.ts` (GET/PATCH), `reservations/[id]/cancel/route.ts` (POST), `reservations/[id]/payments/route.ts` (POST)
- Reads: `availability`, `rooms`, `rooms/[id]` (PATCH cleaning), `channels`, `guests`, `blocks`, `dashboard/today`
- Payments: `payments/[id]/route.ts` (DELETE)
- Feeds + sync: `feeds/route.ts`, `feeds/[id]/route.ts`, `sync/route.ts`, `ical/[token]/[room]/route.ts` (public, token-gated), `cron/sync/route.ts` (CRON_SECRET-gated)
- Auth: `auth/login/route.ts`, `auth/logout/route.ts`

## Naming Conventions

- **Files:** components `PascalCase.tsx`; lib modules `kebab-or-single-word.ts`; pages always `page.tsx`; route handlers always `route.ts`.
- **Dynamic segments:** `[id]`, `[token]`, `[room]` (Next.js `params` is a `Promise`, awaited in handlers/pages).
- **DB:** Prisma models PascalCase; tables/columns snake_case via `@@map` / `@map` to mirror the SQL blueprint (so raw migrations reference `room_id`, `stay`, `status`).
- **Exports:** named exports preferred across `lib`/`components`; pages and layouts use `default` (Next.js requirement).
- **Tests:** `tests/<topic>.test.ts`, matched by Vitest's default glob.

## Public vs Gated Surface

- **Gated by `src/middleware.ts`** (owner cookie): all pages + most APIs.
- **Public (excluded in middleware matcher):** `/login`, `/api/auth/*`, `/api/ical/*` (token-gated), `/api/cron/*` (CRON_SECRET-gated), static/PWA assets (`icons`, `manifest.webmanifest`).
