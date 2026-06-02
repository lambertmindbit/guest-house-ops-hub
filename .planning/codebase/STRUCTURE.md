# Codebase Structure

**Analysis Date:** 2026-06-02

## Directory Layout

```
OTA/
├── src/
│   ├── app/                # App Router: pages + API routes
│   │   ├── api/            # Route handlers ({data}/{error} envelope)
│   │   ├── layout.tsx      # Root layout (fonts, PWA meta, NavShell)
│   │   ├── globals.css     # Tailwind + design-system tokens
│   │   ├── page.tsx        # Today dashboard (home route)
│   │   └── <feature>/      # calendar, guests, pricing, finance, etc.
│   ├── components/         # Reusable + "use client" interactive UI
│   ├── lib/                # Domain logic + utilities (Prisma-backed)
│   └── middleware.ts       # Edge auth gate over all routes
├── prisma/
│   ├── schema.prisma       # Models (daterange cols declared Unsupported)
│   ├── migrations/         # SQL migrations (hand-edited GiST constraint)
│   └── seed.mjs            # Sample rooms/types + 5 channels
├── tests/                  # Vitest integration suite + safety setup
├── scripts/
│   ├── migrate.mjs         # Safe migration helper (strips DROP DEFAULT)
│   └── generate-icons.mjs  # PWA icon generation
├── public/                 # Static assets (PWA icons, manifest)
├── .github/workflows/      # CI (lint, migrate, build, test)
├── docker-compose.yml      # Local Postgres
├── prisma/schema.prisma    # (see above)
├── package.json            # Scripts + deps
└── vitest.config.ts        # Test runner config (loads dotenv)
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router tree — both pages (`page.tsx`) and API routes (`api/**/route.ts`).
- Contains: One folder per route; `[id]`/`[token]` dynamic segments; co-located Zod schemas inside route files.
- Key files: `src/app/page.tsx` (Today), `src/app/layout.tsx`, `src/app/globals.css`.

**`src/app/api/`:**
- Purpose: HTTP endpoints for client mutations, exports, and external feeds.
- Contains: Resource folders (`reservations`, `guests`, `rooms`, `pricing`, `expenses`, `payments`, `feeds`, `seasons`, `channels`, `room-types`, `blocks`, `settings`), plus `auth`, `availability`, `dashboard`, `export`, `ical`, `cron`, `sync`.
- Key files: `src/app/api/reservations/route.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/export/reservations.csv/route.ts`.

**`src/components/`:**
- Purpose: Reusable presentation + interactive client islands.
- Contains: `ui.tsx` (shared primitives: PageHead, KPI, GuestRow, Icon, etc.) and `"use client"` components (forms, panels, action buttons).
- Key files: `src/components/ui.tsx`, `src/components/NavShell.tsx`, `src/components/ReservationForm.tsx`, `src/components/RateCalendar.tsx`, `src/components/PaymentsPanel.tsx`.

**`src/lib/`:**
- Purpose: All domain logic and shared utilities. Server-only; called by pages and routes.
- Contains: feature modules (`availability`, `reservations`, `calendar`, `dashboard`, `conflicts`, `housekeeping`, `finance`, `analytics`, `pricing`, `ical`, `ical-import`) and cross-cutting utilities (`auth`, `api`, `prisma`, `dates`, `format`, `csv`, `db-errors`).
- Key files: `src/lib/availability.ts`, `src/lib/api.ts`, `src/lib/prisma.ts`, `src/lib/db-errors.ts`, `src/lib/dates.ts`.

**`prisma/`:**
- Purpose: Schema, migrations, and seed.
- Contains: `schema.prisma`, `migrations/<timestamp>_<name>/migration.sql`, `migration_lock.toml`, `seed.mjs`.
- Key files: `prisma/migrations/20260601114302_init/migration.sql` (holds `btree_gist`, generated daterange columns, and the `no_overlapping_confirmed_stays` exclusion constraint).

**`tests/`:**
- Purpose: Vitest integration suite focused on the correctness core.
- Contains: `availability.test.ts`, `conflict.test.ts`, `pricing.test.ts`, and `setup.ts` (refuses to run against a non-test DB).

**`scripts/`:**
- Purpose: Build/migration tooling.
- Contains: `migrate.mjs` (create + strip spurious `DROP DEFAULT` + verify constraint), `generate-icons.mjs`.

**`.github/workflows/`:**
- Purpose: CI pipeline.
- Key files: `ci.yml` — spins ephemeral `postgres:16`, runs lint → migrate deploy → build → test.

## Key File Locations

**Entry Points:**
- `src/middleware.ts`: Edge auth gate across all routes.
- `src/app/layout.tsx`: Root layout.
- `src/app/page.tsx`: Today dashboard (home).

**Configuration:**
- `prisma/schema.prisma`: Data model.
- `docker-compose.yml`: Local Postgres.
- `next.config.mjs`, `tsconfig.json` (strict, `@/*` alias), `eslint.config.mjs`, `postcss.config.mjs`, `vitest.config.ts`, `vercel.json`.
- `.env` (git-ignored) / `.env.example`: env placeholders (`DATABASE_URL`, `AUTH_SECRET`, `OWNER_EMAIL`, `OWNER_PASSWORD`, `TEST_DATABASE_URL`).

**Core Logic:**
- `src/lib/availability.ts`: Derived availability (raw SQL).
- `src/lib/reservations.ts` + `src/lib/db-errors.ts`: Overlap-safe writes.
- `src/lib/pricing.ts`: Advisory pricing engine.
- `src/lib/api.ts`: Response envelope helpers.

**Testing:**
- `tests/*.test.ts`: Integration tests.
- `tests/setup.ts`: Test-DB safety gate.

## Naming Conventions

**Files:**
- Pages/routes: lowercase folder + `page.tsx` / `route.ts` (App Router requirement).
- Components: PascalCase `.tsx` (`ReservationForm.tsx`); shared primitives in lowercase `ui.tsx`.
- Domain/util modules: lowercase, hyphenated where multi-word (`ical-import.ts`, `db-errors.ts`).
- Scripts/seed: `.mjs` (plain ESM Node, run outside the bundler).
- Migrations: `<timestamp>_<snake_case_name>/migration.sql`.

**Directories:**
- Route segments lowercase, plural for collections (`reservations`, `guests`); dynamic segments bracketed (`[id]`, `[token]`).

**Code identifiers:**
- DB columns snake_case in Postgres, mapped to camelCase Prisma fields via `@map`; tables `@@map`ped to snake_case plural.
- Named exports preferred; async/await over raw promises (per `CLAUDE.md`).

## Where to Add New Code

**New page (UI route):**
- Primary code: `src/app/<feature>/page.tsx` (async server component; add `export const dynamic = "force-dynamic"` if it reads live data).
- Interactive parts: `src/components/<Feature>Client.tsx` with `"use client"`.
- Add nav entry: `src/components/NavShell.tsx` (`PRIMARY` or `MORE` array).

**New API endpoint:**
- Implementation: `src/app/api/<resource>/route.ts` (or `[id]/route.ts`).
- Validate with a co-located Zod schema; return via `ok`/`fail`/`zodFail` from `src/lib/api.ts`.

**New domain logic:**
- Implementation: `src/lib/<feature>.ts`; import `prisma` from `src/lib/prisma.ts` and date helpers from `src/lib/dates.ts`.

**New model / schema change:**
- Edit `prisma/schema.prisma`, then run `node scripts/migrate.mjs <name>` (not raw `prisma migrate dev`) so the generated-column `DROP DEFAULT` lines are stripped and the exclusion constraint is verified.

**Tests:**
- Add `tests/<area>.test.ts`; ensure `TEST_DATABASE_URL` points at a disposable DB.

## Special Directories

**`prisma/migrations/`:**
- Purpose: Ordered SQL migrations; the init migration hand-edits the GiST constraint.
- Generated: Yes (then hand-edited). Committed: Yes.

**`public/`:**
- Purpose: PWA icons + manifest, served statically.
- Generated: Icons via `scripts/generate-icons.mjs`. Committed: Yes.

**`.next/`, `node_modules/`, `tsconfig.tsbuildinfo`:**
- Purpose: Build output / deps / incremental TS cache.
- Generated: Yes. Committed: No (git-ignored).

---

*Structure analysis: 2026-06-02*
