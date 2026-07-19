# Business Rules Catalogue
## Discovery doc 05 · v1.0 · 2026-07-16

Format: **ID · Description · Trigger · Validation · Expected result**. Status: ✅ implemented (per sources) · 🟡 partial · ✖ proposed/`[R]` · `[Q]` undefined, see doc 09. Rules marked ✖/`[Q]` are *candidate* rules — per the "do not invent rules" instruction they require stakeholder ratification.

## Booking (BR-BOOK)
| ID | Description | Trigger | Validation | Expected result | Status |
|---|---|---|---|---|---|
| BR-BOOK-01 | Two confirmed reservations for one room can never overlap | Any reservation write | Postgres GiST exclusion (room_id =, stay &&) WHERE status='confirmed' | Write rejected at DB; friendly 409 | ✅ |
| BR-BOOK-02 | Stay is half-open `[in, out)` — checkout day is bookable | Create/edit | checkOut > checkIn | Back-to-back turnover legal | ✅ |
| BR-BOOK-03 | Availability is derived, never stored | Any read | units − confirmed overlaps − block overlaps | No drift possible | ✅ |
| BR-BOOK-04 | Guest deduped by phone at entry | Phone entered | Exact match on normalized phone | Existing record reused | ✅ (normalization `[Q]`) |
| BR-BOOK-05 | Blacklist/scam-number hits warn but never block | Phone/guest matched | Lookup local + shared lists | Amber warning; proceed allowed | ✅ |
| BR-BOOK-06 | Cancelled/no-show stays don't occupy dates | Status change | Constraint scoped to confirmed | Dates instantly rebookable | ✅ |
| BR-BOOK-07 | ID-confirmation tick required at booking per property setting | Save | Setting: require ID number Y/N | Save blocked if required & missing | ✅ |
| BR-BOOK-08 | Booking may be attributed to at most one travel agent | Save | agentId optional FK | Commission owed accrues to agent | ✅ |
| BR-BOOK-09 | Room-type-level (unassigned) booking not supported — room chosen at creation | Create | roomId mandatory | No type-level oversell possible; less flexible peak selling | ✅ by design (`[Q Q-OPS-05]` ratify) |
| BR-BOOK-10 | Max advance-booking horizon & max stay length | Create | limits TBD | Reject absurd ranges | ✖ `[Q Q-OPS-01]` |
| BR-BOOK-11 | Archived room cannot take new bookings; existing future bookings — TBD | Archive action | check future stays | TBD: block archive vs orphan | `[Q Q-OPS-02]` |

## Cancellation & refunds (BR-CANC)
| ID | Description | Trigger | Validation | Expected result | Status |
|---|---|---|---|---|---|
| BR-CANC-01 | Refund ladder: ordered tiers days-before → % | Cancellation | policy tiers exist | Suggested refund computed | ✅ |
| BR-CANC-02 | Owner may approve an amount different from suggestion | Refund approval | owner role | Recorded amount wins; audited | ✅ |
| BR-CANC-03 | Refund cannot exceed amount actually paid | Refund entry | sum(payments) | Cap at paid | ✖ `[R]` |
| BR-CANC-04 | Ladder base = gross amount vs amount paid | Computation | TBD | Deterministic refunds | `[Q Q-FIN-07]` |
| BR-CANC-05 | OTA-collect cancellations: OTA policy governs guest refund; hub records only | OTA cancellation | channel = OTA & collects_payment | No double refund | ✖ `[Q Q-FIN-07]` |
| BR-CANC-06 | No-show: definition, deadline, charge, who marks | Night of arrival | TBD | Consistent no-show handling; feeds reliability score | `[Q Q-OPS-04]` |

## Pricing (BR-PRC)
| ID | Description | Trigger | Validation | Expected result | Status |
|---|---|---|---|---|---|
| BR-PRC-01 | Every suggestion clamped to room-type floor/ceiling | Rate calc | floor ≤ rate ≤ ceiling | No absurd price ever suggested | ✅ |
| BR-PRC-02 | Rules compound (weekend, season, lead-time, occupancy) then clamp | Rate calc | order documented? | Deterministic rate | ✅ (order `[Q Q-OPS-08]`) |
| BR-PRC-03 | Manual override (pin) beats rules for that type+date | Owner pins | — | Pinned rate shown with dot; used in suggestions | ✅ |
| BR-PRC-04 | Pricing never pushes to OTAs and never rewrites saved bookings | Always | — | Advisory only | ✅ (hard stance) |
| BR-PRC-05 | Suggested price pre-fills but operator may override freely | New booking | — | Human keeps control | ✅ |

## Availability & sync (BR-AVL)
| ID | Description | Trigger | Validation | Expected result | Status |
|---|---|---|---|---|---|
| BR-AVL-01 | Imported iCal busy dates create blocks per room | Sync | feed parse | OTA bookings can't be double-sold internally | ✅ |
| BR-AVL-02 | Block × booking overlap = conflict flagged, never auto-resolved | Sync/manual block | overlap check | Human decides (WF-12) | ✅ |
| BR-AVL-03 | iCal export exposes busy/free only — no guest data, no rates | Export | — | Privacy preserved | ✅ |
| BR-AVL-04 | OTA listing ↔ hub room mapping must be 1:1 for iCal to protect | Onboarding | mapping check | Multi-unit mismatch prevented | ✖ `[R]` onboarding rule |
| BR-AVL-05 | Feed sync failure > N hours alerts owner | Cron | last-success age | No silent staleness | ✖ GAP-5 |
| BR-AVL-06 | Optional last-room buffer withheld from OTA/agent-facing availability | Availability read | buffer setting | Reduced oversell in lag window | ✖ GAP-24 |

## Guests (BR-GST)
| ID | Description | Trigger | Validation | Expected result | Status |
|---|---|---|---|---|---|
| BR-GST-01 | Guests shared owner-wide across properties; bookings/finance per-property | Any guest read | tenancy design | Repeat recognition everywhere | ✅ (decision 2026-07-15) |
| BR-GST-02 | Reliability score derived from no-shows; repeat no-show badge; owner may raise shared alert | No-show recorded | score formula `[Q]` | Risk visible at booking | ✅ (formula undocumented) |
| BR-GST-03 | Blacklist is per-owner; shared bad-guest alerts are opt-in, evidence-backed, expiring | Toggle / report | evidence for shared | Warn at booking | ✅ |
| BR-GST-04 | Consent recorded before storing personal details | Guest edit | consent tick | DPDP basis | ✅ capture / ✖ enforcement `[Q]` |
| BR-GST-05 | ID scans auto-delete after property retention period | Nightly cron | idRetentionDays set | PII minimization | 🟡 inert until configured — default needed `[R]` |

## Check-in (BR-CHK)
| ID | Description | Trigger | Validation | Expected result | Status |
|---|---|---|---|---|---|
| BR-CHK-01 | Check-in gated on ID (number/scan/verified) per strictness block/warn/off | Check-in tap | property setting | Enforcement matches owner policy | ✅ |
| BR-CHK-02 | Foreign guest additionally requires C-Form fields before check-in | Check-in tap | nationality → foreign | Legal capture complete | ✅ (foreign detection `[Q Q-OPS-10]`) |
| BR-CHK-03 | Stay stages move one step at a time; Undo reverses one | Buttons | state machine | No skipped states | ✅ |
| BR-CHK-04 | C-Form due within 24h of foreign arrival — reminder + artefact | Check-in | timer | Compliance artefact produced | ✖ GAP-7 |
| BR-CHK-05 | Check-out with outstanding balance: allowed/warned/blocked | Check-out tap | balance>0 | TBD | `[Q Q-OPS-03]` |

## Payments (BR-PAY)
| ID | Description | Trigger | Validation | Expected result | Status |
|---|---|---|---|---|---|
| BR-PAY-01 | Multiple part-payments per booking; balance derived | Add payment | — | Balance always truthful | ✅ |
| BR-PAY-02 | UPI/bank payments require full verification checklist + UTR before save | Mode selected | all boxes ticked | Fake-payment scams blocked | ✅ |
| BR-PAY-03 | Advance status derived from advance-tagged payments vs required flag | Payment save | isAdvance | Pending → received automatically | ✅ |
| BR-PAY-04 | UPI link/QR always equals current outstanding balance | Render | derived balance | No stale amounts | ✅ |
| BR-PAY-05 | Payment records immutable; corrections via void+reversal, audited | Edit attempt | — | Clean audit trail | ✖ `[Q Q-FIN-04]` |
| BR-PAY-06 | Overpayment handling (credit/refund) | amount > balance | TBD | Defined behaviour | `[Q Q-FIN-06]` |
| BR-PAY-07 | Money stored as integer paise (or decimal) | All money ops | type | Accounting-grade arithmetic | ✖ GAP-9 |
| BR-PAY-08 | Gateway webhooks idempotent; hold expires → room released | Razorpay events | idempotency key; deadline | No double-post; no zombie holds | 🟡 designed |

## Finance (BR-FIN)
| ID | Description | Trigger | Validation | Expected result | Status |
|---|---|---|---|---|---|
| BR-FIN-01 | Net = gross − channel commission − expenses | Finance view | — | True profit visible | ✅ |
| BR-FIN-02 | Channel commission % configured per channel; agent commission separately per agent; both may apply | Booking attribution | — | Correct owed amounts | ✅ (stacking arithmetic `[Q Q-FIN-01]`) |
| BR-FIN-03 | Commission basis (gross vs net-of-GST; MMT net-rate model) | Config | per-channel model | Correct net | `[Q Q-FIN-01]` |
| BR-FIN-04 | Money views restricted to owner role — including API field level | Any response | role | No leakage to staff | 🟡 page-level only (GAP-12) |
| BR-FIN-05 | Date-range semantics for finance/analytics (stay vs booking vs payment date) documented | Report render | — | No silent misreads | `[Q Q-FIN-09]` |
| BR-FIN-06 | Invoices: sequential per-FY numbering, immutable snapshot, GST lines when registered | Invoice issue | GSTIN present | Statutory compliance | ✖ GAP-11 |

## Housekeeping (BR-HK)
| ID | Description | Trigger | Validation | Expected result | Status |
|---|---|---|---|---|---|
| BR-HK-01 | Checkout ⇒ room enters To-clean automatically (derived) | Check-out | — | Nothing forgotten | ✅ |
| BR-HK-02 | Same-day arrival on a dirty room ⇒ "clean first" priority | List render | arrival today | Priority visible | ✅ |
| BR-HK-03 | Manual "needs cleaning" any time; Mark clean returns to Ready | Buttons | — | Owner-controlled state | ✅ |
| BR-HK-04 | Cleaning may be assigned to staff with checklist | Assignment | staff active | Accountability | ✅ |

## OTA sync & ingestion (BR-OTA)
| ID | Description | Trigger | Validation | Expected result | Status |
|---|---|---|---|---|---|
| BR-OTA-01 | Nothing is ever booked automatically from email — human review mandatory | Ingest | pending-review state | Operator confirms all OTA bookings | ✅ (invariant to preserve) |
| BR-OTA-02 | Ingest webhook token-gated, fail-closed | POST /ingest | token | No spoofed bookings | ✅ |
| BR-OTA-03 | Duplicate confirmations suppressed by ota_ref | Parse | ref match | One booking per OTA ref | `[verify]` |
| BR-OTA-04 | Modification/cancellation emails link to existing booking for guided update | Parse | ref match | No ghost availability | ✖ GAP-2 |
| BR-OTA-05 | No scraping / no extranet automation, ever | — | code review | Listings never endangered | ✅ hard rule |

## AI / approval (BR-AI)
| ID | Description | Trigger | Validation | Expected result | Status |
|---|---|---|---|---|---|
| BR-AI-01 | Agent may read availability/quote and create conflict-checked bookings; never money, never cancellations | Seam call | endpoint whitelist | Blast radius contained | ✅ |
| BR-AI-02 | Sensitive actions file escalations; a human commits via normal RBAC screens | Agent intent | category list | HITL always | ✅ |
| BR-AI-03 | Security prompt outranks owner policies; personas isolated (owner tools never in guest agent) | Every turn | startup assertion | No privilege leak via prompt | ✅ |
| BR-AI-04 | Owner policies editable at runtime, applied ≤ ~1 min | Settings save | — | No redeploys | ✅ |
| BR-AI-05 | High-severity escalation notifies owner's phone within X min | Escalation filed | severity | After-hours coverage real | ✖ GAP-14 |
| BR-AI-06 | Agent bookings run the same scam/blacklist warning logic; hard-block rules TBD | Seam create | lists | Parity with human path | `[Q Q-AI-03]` |

## Community (BR-COM)
| ID | Description | Trigger | Validation | Expected result | Status |
|---|---|---|---|---|---|
| BR-COM-01 | Everything opt-in per peer per share-type; default nothing shared | Grant toggle | — | Owner sovereignty | ✅ |
| BR-COM-02 | Guest PII, occupancy, finance never cross the community seam | Any share | seam contract | Privacy floor | ✅ (referral PII tension `[Q Q-LEG-05]`) |
| BR-COM-03 | Shared reports require evidence; disputable; auto-expire | Report | evidence attached | Fair, decaying signals | ✅ |
| BR-COM-04 | Phone matching via hashed codes, never raw numbers | Match | keyed hash `[R]` | Re-identification resistant | ✅ intent (`[Q Q-SEC-05]` strength) |
| BR-COM-05 | Referral revenue attributed; reciprocal credit derived, never stored | Referral completes | ledger calc | Auditable balances | ✅ |
| BR-COM-06 | Credit settlement / dispute / disconnect handling | Imbalance events | TBD | Defined economics | `[Q Q-BUS-06]` |

## Permissions (BR-PRM)
| ID | Description | Status |
|---|---|---|
| BR-PRM-01 | Owner: all. Reception: ops, no money/setup. Housekeeping: Today + Cleaning only | ✅ |
| BR-PRM-02 | Reception records payments yet "money is owner-only" — boundary: reception may *record*, only owner *views aggregates/finance* | `[Q Q-FIN-05]` ratify |
| BR-PRM-03 | Per-user per-property access grants | ✅ |
| BR-PRM-04 | Role change / disable revokes active sessions | `[Q Q-SEC-03]` |
| BR-PRM-05 | Audit log records sensitive actions incl. who/when | ✅ (coverage widening GAP-15) |
