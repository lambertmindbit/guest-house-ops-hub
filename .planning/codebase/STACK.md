# Technology Stack

**Analysis Date:** 2026-06-02

## Languages

**Primary:**
- TypeScript ^5.7.0 (`strict: true`) - All application code under `src/`, config in `tsconfig.json`
- TSX/React - UI components and App Router pages (`src/app/`, `src/components/`)

**Secondary:**
- JavaScript (ESM `.mjs`) - Build/ops scripts: `prisma/seed.mjs`, `scripts/migrate.mjs`, `scripts/generate-icons.mjs`, and all config files (`next.config.mjs`, `postcss.config.mjs`, `eslint.config.mjs`)
- SQL - Raw migrations under `prisma/migrations/` (the GiST exclusion constraint and `daterange` GENERATED columns live here, not in Prisma)
- CSS - `src/app/globals.css` (Tailwind v4 entry + design tokens)

## Runtime

**Environment:**
- Node.js 22 (pinned in CI: `.github/workflows/ci.yml` uses `node-version: 22`). No `.nvmrc` present.
- Next.js server runtime (Node) for route handlers; Edge runtime for `src/middleware.ts` (auth uses Web Crypto so the same code runs in both).

**Package Manager:**
- npm
- Lockfile: present (`package-lock.json`, ~278 KB, committed)

## Frameworks

**Core:**
- Next.js ^15.2.0 (App Router) - Frontend + API routes in one codebase. Config: `next.config.mjs`
- React ^19.0.0 / React DOM ^19.0.0 - UI layer

**Testing:**
- Vitest ^3.0.0 - Test runner. Config: `vitest.config.ts`. Runs in `node` environment, serially (`fileParallelism: false`), against a real Postgres. Setup files: `dotenv/config` + `tests/setup.ts`.

**Build/Dev:**
- Prisma ^6.5.0 (`prisma` CLI + `@prisma/client`) - ORM, migrations, client generation. `postinstall` and `build` both run `prisma generate`.
- Tailwind CSS ^4.0.0 - Utility-first styling via `@tailwindcss/postcss`. Config: `postcss.config.mjs` (no `tailwind.config.*` file — Tailwind v4 is CSS-first; tokens live in `src/app/globals.css`).
- PostCSS ^8.5.0 - CSS pipeline
- ESLint ^9.20.0 (flat config) with `eslint-config-next` ^15.2.0 - Lint. Config: `eslint.config.mjs` extending `next/core-web-vitals` + `next/typescript`.

## Key Dependencies

**Critical:**
- `@prisma/client` ^6.5.0 - Type-safe DB access. Singleton in `src/lib/prisma.ts` (reused across hot-reloads in dev).
- `zod` ^3.24.0 - Runtime validation of all API inputs (co-located Zod schemas in route handlers under `src/app/api/`).
- `date-fns` ^4.1.0 - Date math (half-open `[check-in, check-out)` stay logic, calendar grids). Property local time (`Asia/Kolkata`) is the reference.
- `node-ical` ^0.26.1 - Parses external OTA iCal feeds on import. CJS package; marked `serverExternalPackages` in `next.config.mjs` so it loads at runtime instead of being bundled.

**Infrastructure:**
- `dotenv` ^16.4.0 (dev) - Loads `.env` into the Vitest suite before tests run.
- `@eslint/eslintrc` ^3.2.0 (dev) - `FlatCompat` shim for the legacy `extends` config style.

## Configuration

**Environment:**
- Configured via `.env` (git-ignored). Documented placeholders in `.env.example`.
- Required vars: `DATABASE_URL`, `OWNER_EMAIL`, `OWNER_PASSWORD`, `AUTH_SECRET`, `ICAL_FEED_TOKEN`, `CRON_SECRET`. Optional: `TEST_DATABASE_URL`, `ALLOW_PROD_DB_TESTS`. See INTEGRATIONS.md for details.
- `tsconfig.json` path alias: `@/*` → `./src/*` (mirrored in `vitest.config.ts`).

**Build:**
- `next.config.mjs` - Only setting: `serverExternalPackages: ["node-ical"]`.
- `tsconfig.json` - `target: ES2022`, `module: esnext`, `moduleResolution: bundler`, `strict`, `noEmit`, `jsx: preserve`, Next plugin.
- `prisma/schema.prisma` - `prisma-client-js` generator, `postgresql` datasource (`env("DATABASE_URL")`). `daterange` columns declared `Unsupported("daterange")?`; exclusion constraint lives in raw SQL migrations.
- `vercel.json` - One daily cron (see INTEGRATIONS.md).

## Platform Requirements

**Development:**
- Node 22, npm, PostgreSQL 16 (ships `btree_gist`, required by the exclusion constraint).
- Local Postgres available via `docker-compose.yml` (`postgres:16`, user/pass/db all `ota`, port 5432). Dev `DATABASE_URL` typically points at hosted Supabase instead.
- Commands: `npm run dev` (port 3100), `npm run db:migrate`, `npm run db:seed`, `npm test`, `npm run lint`. Custom migration helper: `npm run db:migrate:new` → `node scripts/migrate.mjs`.

**Production:**
- Vercel (serverless) hosting. `npm run build` runs `prisma generate && next build`. PWA-installable (`public/manifest.webmanifest`, `display: standalone`).

---

*Stack analysis: 2026-06-02*
