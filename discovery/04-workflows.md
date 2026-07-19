# Workflow Analysis
## Discovery doc 04 · v1.0 · 2026-07-16

Each workflow: happy path, alternate paths, failure paths, exception paths. Mermaid diagrams are the version-controllable source for process/sequence diagrams (deliverables "Process Flow Diagrams" and "Sequence Diagrams").

---

## WF-01 New direct booking

```mermaid
flowchart TD
  A[Guest contacts: walk-in / phone / WhatsApp] --> B[Reception taps New booking]
  B --> C[Enter phone → existing guest auto-matched]
  C --> D{Warnings?}
  D -- blacklist / scam number --> E[Amber warning shown — proceed allowed]
  D -- none --> F
  E --> F[Channel, agent?, room, dates, arrival time]
  F --> G[Pricing suggestion pre-fills amount]
  G --> H[ID-confirmation tick → Save]
  H --> I{DB exclusion constraint}
  I -- ok --> J[Confirmed · calendar updates · confirmation drafted to outbox]
  I -- overlap --> K[409: dates no longer available — pick another room/dates]
```

- **Happy:** as diagrammed; < 60 s target.
- **Alternate:** guest new (record created); agent-attributed; advance required (advance status pending until advance-tagged payment); booking taken by AI via seam (same constraint).
- **Failure:** overlap 409 (retry different room); validation errors inline.
- **Exception:** offline — queued locally, synced later; if it clashed meanwhile, app surfaces it (mechanics `[Q Q-TEC-04]`).

## WF-02 OTA booking import (email)

```mermaid
flowchart TD
  A[OTA sends confirmation email to owner inbox] --> B{Ingestion mode}
  B -- manual --> C[Operator pastes email → Parse]
  B -- forwarder --> D[Apps Script / CF Worker → POST /api/ingest/email + token]
  C --> E[InboundBooking staged: Pending review]
  D --> E
  E --> F[Operator verifies guest/dates/amount · picks room]
  F --> G{Create booking}
  G -- ok --> H[Confirmed · appears on calendar]
  G -- overlap --> I[409 → operator resolves: other room / contact OTA guest]
  E -- not a booking --> J[Dismiss]
```

- **Failure:** parser can't extract → staged raw for manual entry; forwarder silently down → **no signal** (GAP-5: heartbeat needed).
- **Exception:** modification/cancellation email → **no linked-update path today** (GAP-2): operator must manually find & edit the booking. Duplicate email → suppress by ota_ref `[verify]`.

## WF-03 iCal sync cycle

- **Happy:** daily cron (+ manual Sync now) pulls each feed → busy events become blocks → export .ics serves our busy dates to OTA.
- **Failure:** fetch error → ? (no alert today, GAP-5); malformed feed → skip? partial apply? `[Q Q-TEC-06]`.
- **Exception:** imported block overlaps existing confirmed stay → **Conflict** flagged red → owner playbook: verify which guest is real, contact OTA, adjust (WF-12).
- **Exception:** event removed at source → block should be released (Q-TEC-06); if not, phantom-busy loses revenue.

## WF-04 Cancellation & refund

```mermaid
flowchart TD
  A[Cancel reservation] --> B[Status → cancelled · dates freed instantly]
  B --> C[Ladder computes refund % by days-before]
  C --> D[Owner approves suggested or different amount]
  D --> E[Refund recorded with status]
  E --> F[Payout executed outside system: UPI/cash]
  B --> G[iCal export updates on next OTA pull — lag window]
```

- **Alternate:** OTA-collect booking — OTA refunds guest per *their* policy; hub records for books only (Q-FIN-07). No-show: mark no_show — policy effects undefined (Q-OPS-04).
- **Failure:** refund > amount paid (guard `[R]`); cancel after check-in (allowed? `[Q]`).
- **Audit:** cancellation + refund are audited events `[F]`.

## WF-05 Guest arrival (check-in)

- **Happy:** Today list → booking → ID gate satisfied (ID number/scan/verified; consent; C-Form for foreigners) → Check in → in-house.
- **Alternate:** strictness=warn → proceed past missing ID with warning; strictness=off → no gate. Undo one step on mistake.
- **Failure:** ID gate blocks → Record ID link → capture → return.
- **Exception:** foreign guest not marked foreign → C-Form silently skipped (validation gap, Q-OPS-10); arrival before room clean → "clean first" flag in housekeeping.

## WF-06 Guest departure (check-out)

- **Happy:** settle balance (WF-07) → Invoice if wanted → Check out → room auto-appears in To-clean → clean → Mark clean → Ready.
- **Exception:** departure with balance due — allowed/blocked? (Q-OPS-03); late checkout — no fee construct (Q-OPS-11).

## WF-07 Payment collection (incl. scam guard)

```mermaid
sequenceDiagram
  participant G as Guest
  participant R as Reception
  participant App as Hub
  R->>App: Add payment (amount, mode)
  alt mode = UPI / bank
    App-->>R: Verification checklist (sender name · funds landed · UTR)
    R->>G: Show QR / send UPI link (balance pre-filled)
    G-->>R: Pays via any UPI app
    R->>App: Enter UTR + tick all items
    App-->>R: Save enabled → payment recorded
  else cash / card / OTA-collect
    App-->>R: Record directly
  end
  App-->>App: Balance due recomputed (derived)
```

- **Failure:** checklist unticked → Save disabled (fake-screenshot scam blocked) `[F]`.
- **Exception:** advance flow (Mark as advance); overpayment (undefined, Q-FIN-06).

## WF-08 Invoice generation
Booking → Invoice → print/Save-PDF. **Gaps:** no stored invoice record/number, no GST lines (GAP-11) — statutory workflow incomplete for GST-registered properties.

## WF-09 Cleaning workflow
Checkout (or manual flag) → To-clean (priority flag if same-day arrival) → assign staff + checklist → Mark clean → Ready. **Missing:** inspection step, block-if-dirty (GAP-20).

## WF-10 Inventory replenishment
Low-stock banner → PO draft → ordered → received (+ manual stock In) → vendor payment recorded → summary. **Gap:** received PO doesn't auto-move stock `[I verify]`.

## WF-11 Maintenance request
Log request (priority/assignee/cost) → in-progress → done; asset service-due flag → Serviced today resets. **Gap:** no auto room-block for disruptive repairs `[R]`.

## WF-12 Conflict resolution (cross-channel double-book)

```mermaid
flowchart TD
  A[Conflict flagged: block × booking overlap] --> B[Open Conflicts screen]
  B --> C{Which is real?}
  C -- OTA guest real --> D[Move/cancel direct booking · apologise/rehouse via referral]
  C -- direct guest real --> E[Cancel at OTA extranet manually · absorb any OTA penalty]
  C -- block stale --> F[Delete imported/manual block]
  D & E & F --> G[Conflict cleared · postmortem: buffer? sync frequency?]
```
This is the costliest failure mode the product manages; needs an owner playbook + (future) referral tie-in `[R]`.

## WF-13 Referral (community overflow)
Full property → Referrals → pick connected peer (rooms shared) → send guest details (consent point `[Q Q-LEG-05]`) → peer accepts → peer books normally (conflict-checked) → revenue attributed → reciprocal credit ledger updates (derived). **Failure:** peer declines/silent → timeout/reassign `[Q]`. **Exception:** disputes on attribution (Q-BUS-06).

## WF-14 AI escalation (HITL)

```mermaid
sequenceDiagram
  participant G as Guest
  participant AI as Assistant (sidecar)
  participant App as Hub
  participant O as Owner/Reception
  G->>AI: "Please cancel my booking" (Khasi/Hindi/English)
  AI->>App: POST /api/agent/escalations (category, severity, summary, link)
  App-->>O: Escalations queue + badge (no push — GAP-14)
  O->>App: Open escalation → read original + summary
  O->>App: Perform cancellation via normal booking screen (RBAC + audit)
  O->>App: Mark resolved
  App-->>AI: (policy) status available
  AI-->>G: Outcome message via outbox
```
**Failure:** AI down → guest gets fallback/no reply; hub unaffected. **Exception:** severity high at 2 am → sits unseen until morning (GAP-14 is the fix).

## WF-15 Scam / bad-guest report (community)
Incident → local flag (scam number w/ reason) → optional share to network: evidence attached → verification → visible to granting peers (hashed match) → dispute/appeal possible → auto-expiry. **Governance owner for verification/adjudication undefined** (Q-LEG-03).

## WF-16 New client onboarding (MindBit fleet — missing workflow, GAP-18)
Target `[R]`: provision deployment+DB → seed → property wizard (profile, rooms, channels, policies) → CSV import → iCal/forwarder setup → staff logins → training (Khasi materials) → go-live checklist. Today: manual, undocumented — critical path for grant milestones.

## WF-17 Backup & restore (missing, GAP-1)
Target `[R]`: nightly automated backup per client → offsite copy → quarterly restore drill → documented RTO/RPO. Today: platform defaults, unverified.
