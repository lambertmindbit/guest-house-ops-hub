# Technology Stack

**Analysis Date:** 2026-06-01

## Languages

**Primary:**
- TypeScript `^5.7.0` (installed 5.x, strict mode) - All application code under `src/`, config in `tsconfig.json`. `strict: true`, `target: ES2022`, `moduleResolution: bundler`, path alias `@/* → ./src/*`.

**Secondary:**
- SQL (PostgreSQL dialect) - Raw migrations in `prisma/migrations/`, notably the DATERANGE generated columns and GiST exclusion constraint in `prisma/migrations/20260601114302_init/migration.sql`.
- JavaScript (ESM `.mjs`) - Build/seed/util scripts: `prisma/seed.mjs`, `scripts/generate-icons.mjs`, and config files (`next.config.mjs`, `postcss.config.mjs`, `eslint.config.mjs`).

## Runtime

**Environment:**
- Node.js - No version pinned (`.nvmrc` / `.node-version` absent, no `engines` field in `package.json`). Targets Vercel's default Node runtime in production; serverless functions for API routes.

**Package Manager:**
- npm
- Lockfile: present (`package-lock.json`, ~278 KB)

## Frameworks

**Core:**
- Next.js `^15.2.0` (installed 15.5.18) - App Router, full-stack (UI + API routes in one codebase). Entry `src/app/layout.tsx`; config `next.config.mjs`. `serverExternalPackages: ["node-ical"]` keeps the CJS iCal parser out of the bundle.
- React `^19.0.0` / React DOM `^19.0.0` (installed 19.2.6) - UI layer, server + client components under `src/app/` and `src/components/`.

**Testing:**
- Vitest `^3.0.0` (installed 3.2.6) - Test runner. Config `vitest.config.ts`: node environment, `fileParallelism: false` (tests hit a real Postgres serially), `.env` loaded via `dotenv/config` setup file. Tests in `tests/conflict.test.ts` and `tests/availability.test.ts`.

**Build/Dev:**
- Tailwind CSS `^4.0.0` (installed 4.3.0) - Styling, mobile-first. Wired through PostCSS via `@tailwindcss/postcss` (`postcss.config.mjs`); imported in `src/app/globals.css`. No `tailwind.config.*` (v4 CSS-first config).
- ESLint `^9.20.0` + `eslint-config-next` `^15.2.0` - Linting via flat config `eslint.config.mjs`.
- Prisma CLI `^6.5.0` (installed 6.19.3) - Migrations, client generation (`postinstall` + `build` run `prisma generate`), seeding, studio.

## Key Dependencies

**Critical:**
- `@prisma/client` `^6.5.0` (installed 6.19.3) - Typed DB access. Singleton client in `src/lib/prisma.ts` (reused across hot reloads). Schema `prisma/schema.prisma`.
- `zod` `^3.24.0` (installed 3.25.76) - Input validation on all API routes; schemas co-located with routes. Helper `zodFail()` in `src/lib/api.ts` turns Zod errors into the `{ error }` envelope.
- `node-ical` `^0.26.1` - Parses external OTA iCal feeds during import (`src/lib/ical-import.ts`). CJS package; marked external in `next.config.mjs`.
- `date-fns` `^4.1.0` (installed 4.4.0) - Date math on client and server.

**Infrastructure:**
- `dotenv` `^16.4.0` (dev) - Loads `.env` for Vitest runs (`vitest.config.ts` setupFiles).
- `@tailwindcss/postcss` `^4.0.0` (dev) - Tailwind v4 PostCSS plugin.
- `@eslint/eslintrc` `^3.2.0` (dev) - Flat-config compatibility shim for ESLint 9.

## Configuration

**Environment:**
- Configured via `.env` (git-ignored). Documented placeholders in `.env.example`.
- Required vars: `DATABASE_URL` (Supabase Postgres), `OWNER_EMAIL`, `OWNER_PASSWORD`, `AUTH_SECRET` (session cookie HMAC), `ICAL_FEED_TOKEN` (public feed URLs), `CRON_SECRET` (Vercel Cron auth).
- `.env` is git-ignored (`.gitignore`); secrets never committed. `*.pem` also ignored.

**Build:**
- `next.config.mjs` - Next config (external packages).
- `tsconfig.json` - TypeScript compiler options.
- `postcss.config.mjs` - Tailwind/PostCSS pipeline.
- `eslint.config.mjs` - Lint rules.
- `vercel.json` - Vercel Cron schedule.
- `prisma/schema.prisma` - DB models + Prisma generator/datasource.

## Platform Requirements

**Development:**
- Node.js + npm.
- PostgreSQL 16: either Supabase (current `DATABASE_URL`) or local via `docker compose up -d db` (`docker-compose.yml`, `postgres:16`, includes the `btree_gist` extension the exclusion constraint needs).
- Dev server on port 3100 (`npm run dev` → `next dev -p 3100`).

**Production:**
- Vercel (serverless functions + cron). Postgres hosted on Supabase, reached via the connection pooler.

## Commands (from `package.json`)

```bash
npm run dev        # next dev -p 3100
npm run build      # prisma generate && next build
npm start          # next start -p 3100
npm run lint       # next lint
npm test           # vitest run --passWithNoTests
npm run test:watch # vitest
npm run db:migrate # prisma migrate dev
npm run db:seed    # prisma db seed  → node prisma/seed.mjs
npm run db:studio  # prisma studio
```

---

*Stack analysis: 2026-06-01*
