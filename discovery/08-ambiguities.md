# Requirement Ambiguities
## Discovery doc 08 · v1.0 · 2026-07-16

Each ambiguity: why it matters, plausible interpretations, recommendation, and the decision required (cross-ref doc 09 question IDs).

| ID | Ambiguity | Why it matters | Interpretations | Recommendation `[R]` | Decision (Q ref) |
|----|-----------|----------------|-----------------|----------------------|------------------|
| AMB-01 | **"Self-hosted"** while reference stack is Vercel+Supabase+Cloud Run | Grant claims "data locally owned"; sales positioning; DPDP cross-border | (a) self-hosted = "owner-controlled, isolated deployment" regardless of cloud; (b) literal on-prem/in-country hosting | Adopt (a) formally but publish residency statement; productise DO/in-country as paid option | Q-INF-01 |
| AMB-02 | **Offline support depth** ("changes offline are saved and sync") | Field reality in Meghalaya; silent data loss if PWA cache is mistaken for a write queue | (a) full write-queue + conflict UX; (b) read cache + limited writes; (c) marketing gloss | Audit code (iteration 2); then spec explicitly which writes queue | Q-TEC-04 |
| AMB-03 | **Room fixed at booking** (no type-level booking) | Peak selling flexibility, OTA norms (book type, assign room later) | (a) deliberate simplicity, keep; (b) add type-level with assignment at check-in (big change touching the constraint) | Keep (a) for MVP; revisit with >10-room pilots | Q-OPS-05 |
| AMB-04 | **Reception vs money**: "money only for owners" yet reception records payments | RBAC boundary + field masking design | (a) reception records but never sees aggregates; (b) payments owner-only | (a), with field-level masking (GAP-12) | Q-FIN-05 |
| AMB-05 | **Commission arithmetic**: basis (gross vs net-of-GST), MMT net-rate model, channel+agent stacking | "Net to you" accuracy = BO-05 | (a) all % on gross, additive; (b) per-channel model config | Start (a) documented, add per-channel model when GST work lands | Q-FIN-01 |
| AMB-06 | **Refund ladder base**: % of gross vs % of paid; interplay with advance | Determinism of refunds; guest disputes | (a) % of gross capped at paid; (b) % of paid | (a) | Q-FIN-07 |
| AMB-07 | **Finance/analytics date semantics**: stay date vs booking date vs payment date | Period reports can silently mislead | any consistent choice, documented | Revenue by stay-night (accrual), cash by payment date; label views | Q-FIN-09 |
| AMB-08 | **No-show policy**: when marked, by whom, charge, refund, reliability-score effect | Guest fairness + shared reliability signals | manual mark only vs auto at N am | Manual mark with prompt next morning; ladder-defined charge | Q-OPS-04 |
| AMB-09 | **Check-out with balance due** | Revenue leakage vs front-desk reality | block / warn / allow | Warn + require owner override; log | Q-OPS-03 |
| AMB-10 | **Foreign-guest detection** for C-Form gate | Legal miss if mis-filed | nationality field drives it vs manual toggle | Nationality-driven with explicit "Indian national?" prompt at check-in | Q-OPS-10 |
| AMB-11 | **Currency setting exists** but money is INR-centric (UPI, GST, ₹) | Multi-currency illusion; display vs accounting | (a) display-only label; (b) true multi-currency | Declare INR-only; currency = display label | Q-FIN-08 |
| AMB-12 | **Community topology**: where shared registries/referrals physically live across isolated client deployments | Legal controllership, SPOF, trust | central MindBit service vs federated peer-to-peer | Document current design (likely central `[I]`); ADR + DPA | Q-LEG-03 |
| AMB-13 | **Referral guest PII** vs "guest details never shared" | Contradiction in User Guide promises | consent-at-referral vs minimal handoff (name+phone only) | Consent capture at referral moment; minimal fields | Q-LEG-05 |
| AMB-14 | **"Verified" scam reports** — verified by whom? | Governance/defamation | reporter evidence auto-check vs MindBit moderation vs peer quorum | Written moderation policy; MindBit adjudicates appeals initially | Q-LEG-03 |
| AMB-15 | **Two-way guest messaging ownership** (hub outbox vs assistant threads) | Duplicate builds / split context | hub grows inbound vs assistant owns conversations, hub logs | Assistant owns conversation; hub shows unified log | Q-AI-04 |
| AMB-16 | **Agent booking guardrails**: scam/blacklist checks at seam parity | AI could book a flagged guest silently | warn-only parity vs hard-block for AI | Parity + escalate-on-flag for AI path | Q-AI-03 |
| AMB-17 | **iCal removed events** → do blocks release? | Phantom busy = lost revenue | full re-sync replace vs append-only | Replace-per-feed on each sync (idempotent) | Q-TEC-06 |
| AMB-18 | **Pricing rule compounding order** | Owner trust in suggestions | multiplicative in fixed order vs sequence-sensitive | Document formula in Help; property-visible trace ("why this price") | Q-OPS-08 |
| AMB-19 | **Group folio billing depth**: one invoice? split payments across rooms? | Group/corporate use cases | view-only aggregation vs true folio accounting | View + combined invoice v1; true folio later | Q-OPS-06 |
| AMB-20 | **PropertySettings vs Property**: schema has `PropertySettings` (+`UserProperty`) but no `Property` model visible in grep | Data-model clarity for new team | PropertySettings *is* the property root vs separate table missed | Verify in iteration 2; document canonical tenancy root | Q-TEC-09 |
| AMB-21 | **"About a month" session length** + revocation on role change | Security posture | fixed 30d vs sliding; revoke semantics | Sliding 30d; revoke on disable/role change | Q-SEC-03 |
| AMB-22 | **Monetisation model** (Q3 milestone): subscription? per-booking? tiered? | Everything commercial downstream | flat monthly vs %-of-bookings vs freemium | Flat monthly per property, pilot-discounted | Q-BUS-03 |
