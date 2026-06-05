# Guest House Operations Hub

A self-hosted, mobile-first web app that gives a small guest-house owner a single
source of truth for **bookings, calendar, guests, housekeeping, pricing, and
finances** across multiple booking channels — software the owner controls instead
of an expensive commercial channel manager.

> **Important architectural reality.** A single small property *cannot* get
> real-time API access to Booking.com / Agoda / MakeMyTrip — those connectivity
> APIs are gated to certified channel-manager partners. So this app is **not** a
> bidirectional channel manager. It is an **internal operations hub** that ingests
> bookings from the owner's own inbox + iCal feeds and direct/WhatsApp bookings,
> pushes availability out only via free iCal export, and owns everything the OTAs
> don't (unified calendar, CRM, housekeeping, pricing decisions, finances).
> See [the hard rules](#hard-rules-do-not-break) below.

---

## Status

All six planned milestones are built and in production:

| Phase | Area | Highlights |
|------:|------|-----------|
| 1 | **Operations core + Admin** | Bookings, unified calendar, today board, guests, housekeeping; room/room-type/channel/property admin; maintenance blocks |
| 2 | **Pricing** | Advisory rate engine (weekend / season / lead-time / occupancy + floor/ceiling) + rate calendar with overrides |
| 3 | **Check-in / out** | Live arrival/departure tracking on the Today board |
| 4 | **Guest CRM** | Stay history, repeat-guest badge, lifetime value, ID, blacklist |
| 5 | **Finance** | Per-channel revenue + commission, expense tracking → net profit |
| 6 | **Invoices / export** | Printable invoices, Bookings/Payments CSV export |

**Keep-ready groundwork** (built behind clean seams, off by default — activate via env):
- **OTA email ingestion** — paste a confirmation email into the **Inbox** screen → review → create; a token-gated webhook seam (`/api/ingest/email`) plus **two ready-to-deploy forwarders** for full automation in [`integrations/`](integrations/) (Gmail Apps Script — no domain; Cloudflare Email Worker — for a domain / multiple properties).
- **Login rate-limiting** — active (10 attempts / IP / 5 min).
- **Guest ID document upload** — Supabase Storage adapter + UI; activate by setting the storage env vars.

Still deferred by design: messaging automation, multi-role auth, server-side PDFs,
pushing rates to OTAs (not possible for a single property). See [docs/ROADMAP.md](docs/ROADMAP.md).

## Tech stack

- **Next.js 15** (App Router) — frontend + API routes in one codebase
- **TypeScript** (strict)
- **PostgreSQL** via **Supabase**, **Prisma** ORM
- **Tailwind CSS v4** (mobile-first, PWA)
- **Zod** validation, **Vitest** tests, **date-fns**
- Hosting: **Vercel** (+ Vercel Cron); CI: **GitHub Actions**

Full inventory: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Quick start

```bash
# 1. Install (Node 22). postinstall runs `prisma generate`.
npm install

# 2. Configure environment
cp .env.example .env        # fill in DATABASE_URL + DIRECT_URL, OWNER_*, secrets
                            # (DATABASE_URL = pooler for the app; DIRECT_URL = direct, for migrations)

# 3. Apply migrations + seed sample data
npm run db:migrate          # apply pending migrations (prisma migrate deploy)
npm run db:seed             # rooms, room types, 5 channels, demo data

# 4. Run (http://localhost:3100)
npm run dev
```

Detailed setup (Supabase connection-string nuances, the separate test database):
**[docs/SETUP.md](docs/SETUP.md)**.

## Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Dev server on **:3100** |
| `npm run build` | `prisma generate` + production build |
| `npm start` | Run the production build on :3100 |
| `npm run lint` | ESLint (Next.js config) |
| `npm test` | Vitest (integration + unit) — refuses to run without `TEST_DATABASE_URL` |
| `npm run db:migrate` | **Apply** pending migrations (`prisma migrate deploy`) |
| `npm run db:migrate:new <name> [--apply]` | **Create** a migration the safe way — see [the migration workflow](docs/CONTRIBUTING.md#database-migrations-read-this-first) |
| `npm run db:seed` | Seed sample data |
| `npm run db:studio` | Prisma Studio |

> ⚠️ **Never run `prisma migrate dev` directly.** This schema uses generated
> `DATERANGE` columns + a GiST exclusion constraint that Prisma's diff engine
> mangles. Always create migrations with `npm run db:migrate:new`. This is the
> single most important thing a new contributor must know — details in
> [CONTRIBUTING](docs/CONTRIBUTING.md#database-migrations-read-this-first).

## Documentation

| Doc | For |
|-----|-----|
| [docs/SETUP.md](docs/SETUP.md) | Getting a local environment running (Supabase, env, test DB) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How it's built, the correctness core, data model, directory map |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Dev workflow, conventions, the safe migration process, testing, PRs |
| [docs/API.md](docs/API.md) | HTTP endpoint reference |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Vercel + Supabase + cron + CI |
| [docs/ROADMAP.md](docs/ROADMAP.md) | What's built, what's deferred, and why |
| [docs/STATUS.html](docs/STATUS.html) | At-a-glance status report (open in a browser) — delivered phases, deferred items, concerns, first tasks |
| [docs/USER-GUIDE.html](docs/USER-GUIDE.html) | **Day-to-day user guide** (open in a browser) — how operators use every screen of the app |
| [integrations/](integrations/) | Ready-to-deploy OTA-email forwarders (Gmail Apps Script / Cloudflare Worker), each with its own step-by-step README |
| [CLAUDE.md](CLAUDE.md) | Original product spec + the hard rules (also used by AI coding agents) |

## Hard rules (do NOT break)

These exist for correctness and to keep the owner's OTA listings safe:

1. **No scrapers / browser automation against OTA extranets.** Ingest only via the
   owner's own inbox and official iCal feeds.
2. **No direct Booking.com / Agoda / MakeMyTrip API integration** — not available
   to a single property.
3. **Availability is always *derived*** from reservations + blocks — never stored
   as a mutable counter.
4. **Never weaken the DB-level no-double-booking constraint** (`no_overlapping_confirmed_stays`).
5. **Never commit secrets** — `.env` is git-ignored; use `.env.example` for placeholders.
6. **Ask before adding heavy dependencies or new services.**

See [CLAUDE.md](CLAUDE.md) for the full rationale.

## License

Private project. All rights reserved by the owner.
