# Escalation Module — Integration Guide

The human-in-the-loop (HITL) inbox shared by every ROOT agent. The AI agents
**file** escalations; a human **acts** on them from the queue. No agent ever
performs a sensitive action itself — this module is the deterministic core's
half of the HITL contract shown in the DPR (Figures 4 and 8).

It is built to the existing repo conventions: domain logic in `src/lib/`,
`{ data }`/`{ error }` envelope via `ok`/`fail`/`zodFail`, Zod at the top of each
route, additive migration via the safe helper, and the same token-gated webhook
pattern as `POST /api/ingest/email`.

## Files in this drop

| File | Goes to | What it is |
|------|---------|------------|
| `prisma-escalation.prisma` | append to `prisma/schema.prisma` | `Escalation` model + 5 enums (additive) |
| `migration-escalation.sql` | reference only | the SQL the helper should emit — eyeball the diff |
| `src/lib/escalations.ts` | `src/lib/` | list / get / create (dedupe) / transition / KPI stats |
| `src/app/api/escalations/route.ts` | same | `GET` list + `POST` manual create (owner cookie) |
| `src/app/api/escalations/[id]/route.ts` | same | `GET` one + `PATCH` triage |
| `src/app/api/agent/escalations/route.ts` | same | **token-gated** `POST` — the agent seam |
| `src/app/escalations/page.tsx` | same | server page (reads via lib) |
| `src/components/EscalationsClient.tsx` | same | queue UI (KPI strip, tabs, triage) |

> These match your documented conventions but were authored against the docs,
> not compiled against the repo. Review the diff and run `npm run lint && npx
> tsc --noEmit && npm test` as usual before merging.

## Wiring — five steps

**1. Schema + migration.** Append the model/enums, then:

```bash
npm run db:migrate:new add_escalations          # review the generated SQL…
npm run db:migrate:new add_escalations --apply  # …then apply + verify constraint
```

Purely additive (new enums + one table); it does not touch the generated
`daterange` columns or the `no_overlapping_confirmed_stays` GiST constraint.

**2. Middleware — exclude the agent seam.** `POST /api/agent/escalations` carries
its own secret and must be reachable without the owner cookie, exactly like
`/api/ingest` and `/api/cron`. In `src/middleware.ts`, add `/api/agent` to the
matcher's exclude list (next to `/api/ingest`):

```ts
// excluded from the owner-cookie gate (carry their own shared secret)
// …/login, /api/auth, /api/ical, /api/cron, /api/ingest,
'/api/agent',
```

**3. Env var.** Add to `.env`, `.env.example`, and Vercel:

```
AGENT_TOKEN=<long random string>   # openssl rand -hex 32
```

The route **fails closed** (401) if `AGENT_TOKEN` is unset, so leaving it blank
keeps the seam dark until the agents are ready.

**4. Register the screen in the nav.** Add `/escalations` to `NavShell.tsx`. It
belongs in the secondary group for now (alongside Inbox/Feeds); promote it to a
primary tab if escalation volume becomes a daily-touch surface. A live count
badge can reuse the cached-badge pattern in `layout.tsx`:

```ts
const openEscalations = await prisma.escalation.count({ where: { status: 'open' } });
```

**5. CSS sanity check.** The UI uses only documented classes (`.card .kpi .tbl
.pill .btn .segmented .select .textarea .empty .banner`) and status tokens
(`--good/--warn/--danger/--tint`-`fill`/`-text`). If your `globals.css` doesn't
expose `--clay-fill`/`--clay-text`, the `high` severity pill falls back to the
`--warn` tokens automatically (it's written as `var(--clay-fill, var(--warn-fill))`).

## The agent contract

The ROOT agents (separate services) file escalations by POSTing JSON to
`/api/agent/escalations` with the shared secret in `x-agent-token` (or
`Authorization: Bearer …`).

```jsonc
{
  "source": "assistant",          // "assistant" | "cab" | "console"
  "category": "customer",         // customer | driver | booking | payment | maintenance | other
  "severity": "high",             // low | medium | high | critical
  "title": "Gluten-free breakfast request",
  "summary": "Guest with a gluten allergy is asking for a different breakfast option for tomorrow.",
  "reason": "Outside the assistant's knowledge — needs the kitchen to confirm.",
  "raisedBy": { "name": "Alice Freeman", "contact": "alice@example.com", "lang": "en" },
  "originalText": "Nga long ba donkam ia ka jingbam kaba…",   // raw guest message (Khasi/Hindi)
  "translatedText": "I need a gluten-free breakfast option…",  // agent's translation
  "related": { "type": "reservation", "id": "clx123…" },        // optional link
  "threadRef": "asst-conv-9f2a",   // agent conversation id, for correlation
  "externalId": "asst-conv-9f2a:evt-3",  // optional idempotency key (safe retries)
  "propertyRef": "lawei-homestay"  // forward-compatible tenant hint (ignored today)
}
```

Response: `201 { "data": { "id", "status": "open", "deduped": false } }`, or
`200 … "deduped": true` if the same `externalId` was already filed.

Smoke test:

```bash
curl -sX POST http://localhost:3100/api/agent/escalations \
  -H "x-agent-token: $AGENT_TOKEN" -H "Content-Type: application/json" \
  -d '{"source":"cab","category":"driver","severity":"critical",
       "title":"Driver cancelled — Shillong→Cherrapunji 24 Jun",
       "summary":"Booked driver cancelled; no fallback accepted. Customer waiting.",
       "reason":"All fallback drivers declined within the rule window.",
       "raisedBy":{"name":"Mark Johnson","contact":"+91…","lang":"kha"},
       "originalText":"Nga lah kylla bus…","translatedText":"I have to cancel the bus…",
       "threadRef":"cab-77","externalId":"cab-77:cancel-1"}'
```

## How each ROOT agent maps onto it

| Agent (DPR) | `source` | Typical escalations | `severity` hint |
|-------------|----------|---------------------|-----------------|
| Guesthouse Assistant (4.1) | `assistant` | Requests outside its knowledge (custom meals, special requests), complaints, anything needing OTP/payment a human must confirm | medium / high |
| Cab Coordination (4.2) | `cab` | Driver cancelled with no fallback, no driver available, dispute | high / critical |
| Workplace Console (4.3) | `console` | A sensitive action the owner must approve (e.g. cancel a booking) — file it instead of acting | high |

For the Console's "cancel a booking" case, the agent files an escalation with
`related: { type:"reservation", id }`; the owner opens the linked reservation and
performs the cancel **through the existing `POST /api/reservations/[id]/cancel`**,
so the no-double-booking core still governs the write. The agent never calls the
cancel route directly. This is the same discipline as the Inbox: external intent
is staged, a human commits the state change through the guarded path.

## Forward-compatible tenancy

`Escalation.property_id` exists but is nullable/unused today (single property).
When the multi-tenancy gate lands: backfill it, make it non-null with an index,
and add `propertyId: tenant.id` to the `where` in `listEscalations` /
`escalationStats` and to `createEscalation`'s `data`. The agent contract already
carries `propertyRef`, so agents don't change — you just start persisting it.

## Why this is the right first integration

It is the smallest seam that connects all three agents to the deterministic core
without giving any agent write access to bookings, money, or guests. Build it
first, point one agent at it, and you've proven the agent↔core contract before
investing in the larger consolidation. See `ROOT_Consolidation_Review.html` for
where it sits in the overall plan.
