# Project: Guest House Operations Hub

## WHY — what this is and why it exists
A self-hosted web app that gives a small guest-house owner a single source of truth for bookings, calendar, guests, and housekeeping across multiple booking channels (own website/WhatsApp, Agoda, Booking.com, MakeMyTrip). It replaces the expensive parts of a commercial channel manager with software the owner controls.

**Critical reality that shapes the whole project — read carefully:**
A single small property *cannot* get direct real-time API access to Booking.com, Agoda, or MakeMyTrip. Those connectivity APIs are gated to certified partners (the channel-manager companies). So this app is **NOT** a true bidirectional channel manager. It is an **internal operations hub** that:
- *Ingests* bookings via the owner's own confirmation emails + iCal feeds (later phases), and direct website/WhatsApp bookings.
- *Pushes* availability/rates out only via free iCal export or, optionally, one cheap paired channel manager (later phases).
- Owns everything the OTAs don't: unified calendar, guest CRM, housekeeping, messaging, pricing decisions, finances, analytics.

## Hard "do NOT" rules
- **Do NOT build scrapers or browser automation against any OTA extranet.** It violates their terms and risks getting the owner's listings suspended. Booking ingestion happens via the owner's own inbox and official iCal feeds only.
- **Do NOT attempt direct Booking.com / Agoda / MakeMyTrip API integration.** It is not available to a single property. If a task seems to need it, stop and flag it.
- **Do NOT store availability as a mutable counter.** Availability is always *derived* from reservations + blocks. (Prevents drift and is the source of correctness.)
- **Do NOT weaken or remove the database double-booking constraint** to make any feature easier. If it gets in the way, that means the feature has a bug.
- **Do NOT commit secrets.** `.env` is git-ignored; use `.env.example` for documented placeholders. No tokens, passwords, or keys in code.
- **Do NOT add heavy dependencies or new services without asking first.**

---

## WHAT — original brief (Phase 1 MVP); the app is now well beyond it

> **⚠️ Status (kept current): this section is the ORIGINAL Phase-1 brief, preserved
> for context. It no longer describes the live system.** All six product
> milestones plus three gap-analysis phases and the AI-agent work are built and in
> production on `main` — bookings, calendar, guests, housekeeping, **pricing,
> finance, analytics, check-in/out, guest CRM, staff/attendance, inventory,
> vendors, transport, tours, complaints, reviews, a regional community network,
> multi-property tenancy + RBAC, and a token-gated AI agent seam** (60 Prisma
> models). For what's actually built vs. deferred, read [README.md](README.md#status)
> and [docs/ROADMAP.md](docs/ROADMAP.md) — those are the source of truth for
> current scope. **Do not treat "build only Phase 1" below as a live instruction.**
> The parts of this file that ARE still binding: the WHY, the **Hard "do NOT"
> rules**, the tech stack, and the data-model correctness core.

The original Phase-1 deliverables and forward-looking roadmap follow, unchanged.

**Phase 1 deliverables (in scope):**
1. Project scaffold (stack below), runnable with one command, with a local Postgres via Docker Compose.
2. Database schema + migrations for: `room_types`, `rooms`, `channels`, `guests`, `reservations`, `blocks`. Reservations must enforce no-double-booking at the DB level (see schema).
3. Seed script: a few sample rooms/room-types and the 5 channels (Direct, WhatsApp, Booking.com, Agoda, MakeMyTrip).
4. API routes: create/list/update/cancel reservation; availability query (derived); today-dashboard summary; create/list maintenance blocks; list/search guests.
5. Mobile-first UI (the owner runs this from a phone):
   - **Today dashboard**: check-ins today, check-outs today, in-house now, arrivals next 7 days, occupancy %.
   - **Unified calendar**: grid of rooms (rows) × dates (columns), colour-coded — vacant/clean, occupied (show guest + channel badge), arriving, departing, blocked, and **conflict** highlighted red. Click a cell → reservation detail.
   - **New / edit reservation form**: guest, channel, room, dates, arrival time, special requests, amount, payment mode. Rejecting an overlapping booking must show a clear, friendly error.
   - **Guests list**: searchable by name/phone.
6. Single-owner login (keep it simple — one account). Conflict detection + friendly handling everywhere a reservation is written.
7. At least integration tests proving: (a) an overlapping confirmed reservation for the same room is rejected, and (b) availability is computed correctly around bookings and blocks.

**Explicitly OUT of Phase 1 scope (defer):** OTA email parsing, iCal import/export, WhatsApp/email/SMS messaging, pricing engine, financial ledger, analytics dashboards, multi-role auth, production deployment hardening.

---

## HOW — tech stack
- **Framework:** Next.js (latest stable, App Router) — frontend + API routes in one codebase. **TypeScript, strict mode.**
- **Styling:** Tailwind CSS. Mobile-first; design for a ~390px phone screen first, then scale up. Make it a PWA so it installs to the home screen.
- **Database:** PostgreSQL. Local dev via Docker Compose. (Prod later: Supabase or a small VPS — both are full Postgres.)
- **ORM:** Prisma for models and most queries. **Important:** Prisma cannot express PostgreSQL exclusion constraints, so the double-booking constraint goes in a *raw SQL migration* (`prisma migrate dev --create-only`, then edit the generated SQL). Do not skip this.
- **Validation:** Zod on all API inputs.
- **Testing:** Vitest. Prioritize tests around booking-conflict and availability logic — that is the correctness core.
- **Dates:** store as Postgres `DATERANGE` for stays (`[check-in, check-out)`, half-open). Use a solid date lib (e.g. date-fns) on the client. Be careful and consistent about timezone — the property's local time is the reference.

### Conventions
- Named exports preferred. Async/await over raw promises.
- Keep API responses consistent (`{ data }` / `{ error }`).
- Co-locate Zod schemas with their routes.
- Small, logical git commits with clear messages. Commit after each working slice.
- Comment the *why*, not the *what*, especially around the booking-conflict logic.

### Commands (you will create these during scaffold; keep this list updated)
- `docker compose up -d db` — start local Postgres
- `npm run dev` — start Next.js dev server
- `npm run db:migrate` — apply Prisma migrations
- `npm run db:seed` — load sample data
- `npm test` — run Vitest
- `npm run lint` — lint

---

## Data model (the correctness core)
Availability is **derived**: for a room-type on a date, available units = (units of that type) − (overlapping confirmed reservations) − (overlapping blocks). Never store a mutable "free rooms" number.

The single most important requirement in Phase 1: **two confirmed reservations for the same physical room must not be able to overlap, enforced by the database, not just app code.** Implement with a Postgres GiST exclusion constraint (requires the `btree_gist` extension), added via a raw SQL migration:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- on the reservations table:
ALTER TABLE reservations
  ADD CONSTRAINT no_overlapping_confirmed_stays
  EXCLUDE USING gist (
    room_id WITH =,
    stay   WITH &&        -- stay is a DATERANGE column, [check-in, check-out)
  ) WHERE (status = 'confirmed');
```

Core tables (translate into Prisma schema + the raw migration above; this mirrors the project blueprint):
`room_types`(id, name, base_rate, max_occupancy, rate_floor, rate_ceiling) ·
`rooms`(id, room_type_id→room_types, label) ·
`channels`(id, name, commission_pct, collects_payment) ·
`guests`(id, name, phone unique, email, notes) ·
`reservations`(id, room_id→rooms, guest_id→guests, channel_id→channels, ota_ref, stay DATERANGE, status['confirmed'|'cancelled'|'no_show'], arrival_time, special_requests, gross_amount, created_at) + the exclusion constraint above ·
`blocks`(id, room_id→rooms, period DATERANGE, reason).

When a write would violate the exclusion constraint, catch the Postgres error and return a clean "those dates are no longer available for this room" message — never a raw 500.

---

## Working style for this session
1. **Read this whole file first.** Then propose a short plan and the exact dependency list, and wait for my OK before scaffolding. Use plan mode where helpful.
2. Build in this order: scaffold → DB schema + exclusion constraint + a failing/passing conflict test → seed → API routes → Today dashboard → calendar → reservation form → guests → login.
3. After each slice, tell me how to run/see it, and commit.
4. Ask before: adding any dependency beyond the stack above, any architectural change, or anything that touches the "do NOT" rules.
5. Keep it simple. This is for one small property, not an enterprise. Resist scope creep.

---

## Full roadmap (context only — do not build beyond Phase 1 yet)
- **Phase 1 — MVP operations hub** *(current)*: rooms, reservations, DB-enforced no-double-booking, unified calendar, today dashboard, guests, single login.
- **Phase 2 — Booking ingestion**: dedicated inbox + email parser for OTA confirmations; iCal import (catch blocked dates) + iCal export feeds; conflict alerts to the owner's phone.
- **Phase 3 — Messaging automation**: WhatsApp Business (Cloud) API + email/SMS; templates + trigger/scheduler engine (confirmation, welcome, check-in/out, thank-you, review request); log messages to the guest's CRM thread.
- **Phase 4 — Dynamic pricing engine**: rule-based multipliers (occupancy, day-of-week, season, events, lead time) with floor/ceiling guards; recommends rates (auto-applies only via a paired channel manager, if any).
- **Phase 5 — Financial dashboard**: per-channel commission rules, transactions ledger across payment modes (cash/UPI/card/bank/OTA-collect), payout tracking, GST, net revenue, true-profit-by-channel.
- **Phase 6 — Analytics & housekeeping polish**: occupancy, ADR, RevPAR, source mix, cancellation rate, length-of-stay; auto-generated prioritized housekeeping tasks; repeat-guest insights.

---

## Appendix — the kickoff message to paste as your first prompt
> Read CLAUDE.md in full before doing anything. This is a Phase 1 MVP build. Don't write code yet — first confirm you understand the project (especially the "do NOT" rules and the derived-availability + DB-level double-booking requirement), then give me: (1) a short build plan in the order listed under "Working style", and (2) the exact list of dependencies you'll install and why. Wait for my approval before scaffolding. Then build Phase 1 slice by slice, telling me how to run each part and committing as you go. Ask before adding anything outside the defined stack.

---

## Karpathy Skills — coding guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
