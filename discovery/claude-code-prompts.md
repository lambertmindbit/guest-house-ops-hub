# Claude Code Prompts — Gap-Fix Programme
Three copy-paste prompts derived from discovery/06-gap-analysis.md, tiered by blast radius against the repo's fragile areas (GiST/migration machinery, money math, tenancy scoping). Run 1 → 2 → 3; each assumes the previous is merged.

Coverage note: all 30 gaps are either in a prompt, documentation-only (GAP-26 ADR, GAP-28 residency statement — write these by hand), external-dependency-gated (GAP-3 WhatsApp templates await Meta; US-407 Razorpay awaits keys; GAP-1/17 backups/monitoring are infra tasks alongside Prompt 2), or parked pending decisions (GAP-29, GAP-26 build work).

---

## Prompt 1 — Safe wins (additive, near-zero breakage risk)

```
Read CLAUDE.md in full first — the hard "do NOT" rules are binding. Then read
discovery/06-gap-analysis.md and discovery/14-backlog.md for context. Work
plan-first: give me a short plan and wait for my OK. One PR-sized commit per
slice, tests green (`npm test`) before each commit. NEVER run `prisma migrate dev`;
any schema change goes through `npm run db:migrate:new`. Do not touch the
exclusion constraint, src/lib/db-errors.ts, or the pricing engine logic.

Fix these, in this order — all additive, none may change existing behaviour:

1. TESTS FIRST (NFR-MNT-02): add a route-level integration test proving that
   creating an overlapping confirmed reservation via the API returns 409 with the
   friendly error envelope (guards the db-errors.ts string-sniffing). Add a
   housekeeping-derivation test (checkout ⇒ to-clean task appears; mark clean ⇒ ready).
2. GAP-5 (surface only): expose `lastSyncAt`/last-success age per iCal feed in the
   Feeds screen and a warning chip on Today when any feed is stale >12h or the
   nightly cron hasn't run. No new services — derive from existing data.
3. US-305: suppress duplicate OTA confirmations — if an InboundBooking's parsed
   ota_ref matches an existing reservation or pending item, flag it as duplicate
   instead of staging a new create.
4. US-306: redact card/virtual-card number patterns from raw ingested email bodies
   before persistence (regex-based, test with a fixture).
5. GAP-15: widen the audit log to also record payment edits, settings changes,
   rate overrides, community share-grant changes, and ID-document views/downloads.
6. BR-GST-05: give `idRetentionDays` a default of 180 on new properties and show a
   one-line notice in Settings → Property explaining the purge.
7. GAP-6: make iCal sync frequency configurable (owner setting, hourly minimum),
   keeping the existing daily default.
8. US-606: add a CI check (script + GitHub Actions step) that fails if any
   `$queryRaw`/`$executeRaw` touching a tenant table lacks a `property_id` filter.
9. GAP-30: add a `db:seed:demo` script that seeds a realistic demo property
   (rooms, bookings across statuses, payments, housekeeping states).
10. GAP-21 (basics): fix contrast failures, add aria-labels to the booking form,
    payments panel and tab bar; ensure touch targets ≥44px. Do not redesign.

After each slice tell me how to verify it, then commit with a clear message.
```

---

## Prompt 2 — Medium complexity (new flows, small schema additions)

```
Read CLAUDE.md fully (hard rules binding), then discovery/06-gap-analysis.md,
discovery/03-module-analysis.md §A6/A8/A10, and docs/ROADMAP.md "Known concerns".
Plan-first; wait for my OK before coding. One slice per commit, tests green.
ALL schema changes via `npm run db:migrate:new` — never `prisma migrate dev`.
The exclusion constraint and derived-availability doctrine must not change:
availability, balances, advance status stay computed, never stored.

Build these, in this order:

1. GAP-10 / US-601/602/603: staff email invites (expiring link, role + property
   pre-assigned), self-service password reset (single-use, rate-limited), and
   session revocation on role change/disable. Pick a minimal transactional email
   path and put credentials behind env vars, off by default — ask me before adding
   any dependency.
2. GAP-14 / US-501: wire web-push. A PushSubscription model already exists in
   prisma/schema.prisma — verify its state first. Notify the owner's subscribed
   devices within 1 minute of: a high-severity escalation, a new calendar
   conflict, a stale sync (from the GAP-5 health data). Per-event toggles in
   Settings. Deep-link each push to the relevant screen.
3. GAP-2 / US-301: OTA modification & cancellation emails. Extend the parser to
   classify email type; match by ota_ref to the existing reservation; the Inbox
   pending item must show a field-level diff and an "Apply" action that updates
   the booking through the normal conflict-checked path (409 handled). Build a
   fixture corpus (I will supply real emails; use synthetic ones meanwhile) and
   run it in CI.
4. GAP-12 (app layer only): field-level money masking — a response serializer
   strips grossAmount, payment amounts and finance aggregates for non-owner
   roles, with role-based contract tests per endpoint. Do NOT attempt Postgres
   RLS in this pass.
5. GAP-7 / US-201: Form C artefact — a print-ready, pre-filled Form C page from
   the guest's 13 C-Form fields, a due-in-24h reminder from foreign-guest
   check-in until a "submitted" checkbox is ticked, both audited.
6. US-605: move shared scam/bad-guest phone matching to a keyed hash (per-network
   pepper from env), with a migration for existing hashes and an enumeration-
   resistance test.
7. GAP-13 / US-405: OTA payout reconciliation — a Payout record (schema addition)
   matched against OTA-collect bookings; Finance shows owed vs received variance.
8. GAP-20: optional housekeeping "inspected" step (off by default per property)
   and a warn-on-book flag for dirty rooms with same-day arrival.

For anything ambiguous, check discovery/08-ambiguities.md; if the answer depends
on an open question (Q-FIN-*, Q-OPS-*), stop and ask me instead of assuming.
```

---

## Prompt 3 — Structural work (money core, schema-wide surgery, big surfaces)

```
Read CLAUDE.md (hard rules binding), docs/ROADMAP.md "Known concerns",
discovery/06-gap-analysis.md and discovery/17-roadmap.md. These changes touch
load-bearing areas. Work strictly plan-first with a written design per item that
I approve before any code. One item at a time — do not start the next until the
previous is merged and green. Schema changes ONLY via `npm run db:migrate:new`;
take a DB backup step in the plan before every migration. The GiST exclusion
constraint must remain byte-identical unless an item explicitly says otherwise.

1. GAP-9 / US-401 (do this FIRST — everything money depends on it): migrate all
   money from whole-rupee `number` to integer paise with a typed Money utility.
   Inventory every money field and calculation (payments, refunds, commissions,
   expenses, finance tiles, CSVs, invoices, pricing suggestions), migrate schema
   + code + display formatting together, and prove with property-based tests and
   a before/after CSV diff on seeded data that every visible rupee value is
   unchanged.
2. GAP-11 / US-205/206: statutory invoicing — a new immutable Invoice entity
   (sequential per-financial-year numbering, snapshot of lines/taxes/payments at
   issue time), GST tax lines driven by property GSTIN config, reprint always
   identical, plus server-side PDF rendering. Ask me before adding a PDF
   dependency. Blocked on my answers to Q-FIN-01/02 — ask for them at planning.
3. GAP-8 / US-202: DPDP data-principal rights — export-all and erase (anonymise
   PII while preserving non-identifying financial/booking integrity and audit
   history). This is cross-cutting: design doc must enumerate every table
   holding guest PII (use discovery/12-data-model.md) before code.
4. GAP-12 (DB layer): Postgres RLS on tenant tables keyed to the session
   property, as defence-in-depth behind the existing Prisma scoping. Must be a
   no-op for correct code; prove with a leak test that unscoped raw SQL is
   contained. High migration risk — staged plan, reversible.
5. GAP-16 / US-801: externalize all UI strings into an i18n framework (ask
   before adding the dependency), English pack extracted 1:1 so rendered output
   is pixel-identical; Khasi pack wiring ready but empty.
6. GAP-18 / US-701/702/703: fleet tooling — scripted client provisioning
   (deploy + DB + seed + env in one command), a first-run owner setup wizard to
   a bookable state, and staged upgrade scripts (canary first, halt on failure,
   pre-migration backup gate).
7. GAP-25 / US-901: offline truth — audit what the PWA actually does offline,
   write the honest spec (which reads are cached, which writes queue, conflict
   UX), correct docs/USER-GUIDE.md if it overstates, then implement a minimal
   safe write-queue for check-in/out and housekeeping marks only.
8. PARKED — do not build without an explicit decision from me: type-level
   booking with room assignment at check-in (GAP-29/Q-OPS-05, redesigns the
   exclusion constraint) and any community-topology change (GAP-26/Q-LEG-03).
```
