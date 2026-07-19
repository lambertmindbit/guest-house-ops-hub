# API Analysis
## Discovery doc 13 · v1.0 · 2026-07-16

Known-from-docs endpoints marked `[F]`; the rest is the **recommended target surface** `[R]` to be reconciled against `docs/API.md` in iteration 2. Conventions (existing): REST under `/api`, Zod-validated inputs, `{data}/{error}` envelope, domain 4xx (409 overlap), token-gated external seams (fail-closed).

## 1. Seams that exist `[F]`
| Group | Endpoint | Auth | Purpose |
|---|---|---|---|
| Agent | `GET /api/agent/availability` | `AGENT_TOKEN` | Free units for dates |
| Agent | `GET /api/agent/quote` | token | Price quote (pricing engine) |
| Agent | `POST /api/agent/reservations` | token | Create booking — same GiST transaction; 409 on overlap |
| Agent | `POST /api/agent/messages` | token | Queue outbound message |
| Agent | `POST /api/agent/escalations` `[I from module A10]` | token | File HITL escalation |
| Agent | `GET /api/agent/policies` | token | Owner runtime policies for assistant |
| Ingest | `POST /api/ingest/email` | ingest token | Staged InboundBooking from forwarders |
| Analytics | `GET /api/analytics/export` | session | CSV of analytics view |
| iCal | `GET /api/ical/…(room).ics` `[I]` | private URL token | Export busy dates |

## 2. Recommended internal REST surface `[R — verify overlap with docs/API.md]`
| Resource | Verbs | Notes |
|---|---|---|
| `/api/reservations` | GET list/search, POST | 409 with `{error:{code:"OVERLAP"}}` |
| `/api/reservations/:id` | GET, PATCH, DELETE(cancel) | cancel returns computed ladder refund |
| `/api/reservations/:id/check-in` · `/check-out` · `/undo` | POST | gate errors: `ID_REQUIRED`, `CFORM_REQUIRED` |
| `/api/reservations/:id/payments` | GET, POST | verification payload for UPI/bank |
| `/api/reservations/:id/refunds` | POST | owner-only |
| `/api/availability` | GET | derived; room-type × date range |
| `/api/blocks` | GET, POST, DELETE | manual + iCal-sourced (read-only delete guard for ical source `[R]`) |
| `/api/guests` (+`/:id`, `/merge` `[R]`) | GET/POST/PATCH | merge = GAP-19 |
| `/api/inbound` | GET, POST(create booking), POST(dismiss) | Inbox review |
| `/api/feeds` | CRUD + `POST /:id/sync` | expose `lastSuccessAt` (GAP-5) |
| `/api/pricing/rates` | GET calendar, PUT override | |
| `/api/finance/…` | GET summaries, expenses CRUD, CSVs | owner-only; field masking (GAP-12) |
| `/api/settings/…` | per Settings section | owner-only |
| `/api/staff`, `/shifts`, `/attendance`, `/housekeeping`, `/maintenance`, `/assets`, `/inventory`, `/vendors`, `/purchase-orders`, `/tours`, `/trips`, `/complaints`, `/reviews`, `/groups` | CRUD per module | role-guarded |
| `/api/community/…` | connections, grants, directory, referrals, reports | grant-gated seam semantics |
| `/api/audit` | GET | owner-only |

## 3. Webhooks (inbound)
| Hook | Status | Requirements |
|---|---|---|
| `POST /api/ingest/email` | ✅ | token; size limits; store-raw-on-parse-fail; **redact card data** (Q-OTA-03) |
| `POST /api/webhooks/razorpay` | designed 🟡 | signature verification + **idempotency key**; hold-expiry release job |
| `POST /api/webhooks/whatsapp` (delivery status + inbound) | ✖ needed with GAP-3/4 | Meta signature; 24h-window bookkeeping |

## 4. Events (internal) `[R]`
Current architecture is synchronous request/response `[I]`. Recommend a light domain-event layer (in-process → DB event table if needed): `reservation.created/cancelled`, `payment.recorded`, `checkin/checkout.completed`, `escalation.filed`, `feed.sync.failed`, `inbound.staged` — consumed by outbox drafts (exists), notifications (GAP-14), audit widening (GAP-15), heartbeats (GAP-5). Avoid external brokers — stay within one process/DB `[R]` (C-06 spirit).

## 5. Auth & session
Cookie session (~30d) `[F]`; add: password reset + invite endpoints (GAP-10), session revocation semantics (Q-SEC-03), owner 2FA optional (FR-AUTH-7).

## 6. Cross-cutting API requirements
| Concern | Requirement |
|---|---|
| Error contract | `{error:{code, message, details?}}`; stable machine codes for OVERLAP, ID_REQUIRED, TOKEN_INVALID, RATE_LIMITED |
| Idempotency | All webhooks; consider `Idempotency-Key` on booking create from agent (retry-safe) `[R]` |
| Rate limits | Login ✅; extend to agent seam + ingest per token; shared store when serverless (NFR-SEC-05) |
| Pagination | List endpoints ≥ default 50 with cursors `[R]` |
| Field masking | Serializer strips money fields for non-owner (GAP-12) |
| Versioning | Seam endpoints: `X-Seam-Version` header + contract tests with sidecar `[R]` |
| Observability | Request logging (no PII), error IDs surfaced to UI (doc 02 §7) |

## 7. Notifications API (GAP-14 target) `[R]`
`POST /api/push/subscribe` (PushSubscription model exists `[F]`); server-side web-push on: escalation(severity≥high), conflict created, feed stale > N h, low stock (optional). Owner-configurable toggles in Settings.
