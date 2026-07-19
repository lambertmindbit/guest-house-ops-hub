# Risk Register
## Discovery doc 07 · v1.0 · 2026-07-16

Scale: Probability/Impact Low·Med·High. Owner = accountable role (MB = MindBit; Eng = engineering; PO = product owner; Own = property owner). Exposure = P×I qualitative.

| ID | Category | Risk | P | I | Exposure | Mitigation | Owner |
|----|----------|------|---|---|----------|------------|-------|
| RSK-01 | Business | Fleet ops (1 deployment/client) exceed 3-founder capacity at 25 clients; support drowns delivery | H | H | **Critical** | Fleet tooling (GAP-18), onboarding wizard, support tiers, hire per grant jobs plan | MB |
| RSK-02 | Business | Grant milestones slip (monetisation Q3, 25 clients Q4) because ops/billing tooling unscoped | M | H | High | Re-baseline roadmap (doc 17) against quarters; treat GAP-18/27 as milestone work | MB/PO |
| RSK-03 | Business | Positioning contradiction ("locally owned" vs US cloud) surfaces in grant due-diligence | M | M–H | High | Honest data-residency statement; DigitalOcean/in-country option productised (GAP-28) | MB |
| RSK-04 | Legal | Shared bad-guest/scam network triggers defamation or DPDP complaint | M | H | **High** | Governance policy, evidence+appeal (exists), keyed hashing, legal review before scale (GAP-26, Q-LEG-03) | MB+counsel |
| RSK-05 | Legal | DPDP non-compliance: ID scans indefinite by default, no erasure/export, no breach procedure | M | H | **High** | GAP-8 workstream; retention default; DPIA-style review | MB+counsel |
| RSK-06 | Legal | Form C non-compliance at pilot properties harms owners (fines/police friction) | M | M–H | High | GAP-7 artefact + reminder; owner training | PO |
| RSK-07 | Legal/Fin | Non-compliant GST invoices issued by registered properties | M | M | Med | GAP-11 before invoicing push; accountant review | PO |
| RSK-08 | Technical | Data loss: no tested restore (backup assumed = platform default) | L–M | **VH** | **Critical** | GAP-1: backups + quarterly drills + runbook | Eng |
| RSK-09 | Technical | Migration fragility (DATERANGE+GiST vs Prisma diff) corrupts a client DB during fleet upgrade | M | H | High | Helper-only migrations (exists), CI guard, staged rollout, pre-migration backup gate | Eng |
| RSK-10 | Technical | Overlap-detection error-string sniffing breaks on Postgres/Prisma upgrade → raw 500s on the core path | M | M | Med | Keep conflict tests green (exists); add route-level test (repo-ack) | Eng |
| RSK-11 | Technical | Money float math produces accounting discrepancies as finance scope grows | M | M–H | High | GAP-9 conversion before gateway/GST | Eng |
| RSK-12 | Technical | Offline claims overstate reality → silent lost writes in the field | M | H | High | GAP-25 verification; explicit offline spec; field test on 2G | Eng |
| RSK-13 | Integration | OTA email format changes silently degrade parsing | H | M | High | Parse-confidence metric, staged-raw fallback (exists), fixture corpus per OTA, alerting (GAP-5) | Eng |
| RSK-14 | Integration | OTA removes/limits iCal for a listing type → sync gone for that property | M | M | Med | Onboarding checks; manual-extranet playbook; channel-manager pairing option | PO |
| RSK-15 | Integration | Meta rejects WhatsApp templates or bans number (policy violations, spam reports) | M | M–H | High | Template review vs policy, opt-out handling, early submission (GAP-3) | Eng/PO |
| RSK-16 | Integration | Gmail Apps Script quotas/fragility break forwarding silently | M | M | Med | Heartbeat (GAP-5); prefer CF Worker for scale | Eng |
| RSK-17 | Security | Cross-property leak via un-scoped raw SQL (within one owner) | M | M | Med | CI grep-guard; RLS defence-in-depth (GAP-12) | Eng |
| RSK-18 | Security | Money fields leak to staff via API responses | H (exists) | L–M | Med | Field-level masking (GAP-12) | Eng |
| RSK-19 | Security | ID-document bucket misconfiguration exposes PII | L–M | VH | High | Private bucket + signed URLs + access logging + config checklist (NFR-SEC-08) | Eng |
| RSK-20 | Security | Hashed phone lists reversible by enumeration (10-digit space) | M | M | Med | Keyed/peppered hash per network (NFR-SEC-09) | Eng |
| RSK-21 | Security | Seam token leakage (AGENT_TOKEN static, long-lived) | L–M | M | Med | Rotation procedure, per-service tokens, IP allowlist where possible | Eng |
| RSK-22 | AI | Assistant hallucinates commitments (price/promise) to guests in Khasi where owner can't easily audit | M | M | Med | HITL for sensitive (exists), policy guardrails (exists), transcript review UI, canned-answer bias | Eng/PO |
| RSK-23 | AI | Prompt injection via guest messages escalates privileges | L–M | M | Med | Canonical security block (exists) + red-team suite (Q-AI-05) | Eng |
| RSK-24 | AI | Gemini/Cloud Run outage or pricing change breaks assistant economics | M | M | Med | Model fallback (exists), cost monitoring, provider abstraction | Eng |
| RSK-25 | Privacy | Guest PII flows to Gemini (US) without adequate notice/consent | M | M–H | High | NFR-PRV-04 notice; evaluate regional endpoints; DPA with Google terms review | MB+counsel |
| RSK-26 | Operational | Owner mis-training: conflicts/escalations ignored (badge-blindness) | M | M | Med | GAP-14 notifications; Khasi training materials; WF-12 playbook | PO |
| RSK-27 | Operational | Key-person risk: one dev understands the migration/tenancy machinery | H | H | **Critical** | This discovery package + ARCHITECTURE docs (exist); pairing; hiring plan | MB |
| RSK-28 | Deployment | Vercel/Supabase free-tier limits or pricing shifts across 25 deployments | M | M | Med | Cost model per client; DO branch as hedge; usage monitoring | MB |
| RSK-29 | Support | No defined support SLA/channel → pilot churn | M | M | Med | Q-SUP-01; in-app help (exists) + WhatsApp support line + triage rota | MB |
| RSK-30 | Data | Community registry (wherever it lives) becomes single point of failure / breach across clients | M | H | High | GAP-26 architecture decision; minimal data, expiry (exists), isolation review | Eng |
| RSK-31 | Scalability | Serverless per-instance rate limiting ineffective under real abuse (public chat) | M | L–M | Low–Med | Shared store when PUBLIC_CHAT on (repo-ack) | Eng |
| RSK-32 | Business | Referral credit imbalances sour peer relationships (no settlement rules) | M | L–M | Med | Q-BUS-06 policy; visibility of balances (exists) | PO |

## Top-5 board-level summary
1. **RSK-08 data loss** — cheap to fix, catastrophic if not.
2. **RSK-01/27 fleet & key-person capacity** — the real constraint on the grant plan.
3. **RSK-04/05 community + DPDP legal exposure** — needs counsel before scale, not after.
4. **RSK-02 milestone slip** — ops/billing tooling must enter the roadmap now.
5. **RSK-13 + GAP-2 OTA ingestion drift** — the quiet killer of the core "single source of truth" promise.
