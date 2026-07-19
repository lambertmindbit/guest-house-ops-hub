# Stakeholder Question Log
## Discovery doc 09 · v1.0 · 2026-07-16

Grouped questionnaire; every question states *why it is asked*. Priority ★ = blocks design decisions now. Answer column left blank for workshop use.

## Business
| ID | Question | Why it matters | ★ | Answer |
|----|----------|----------------|---|--------|
| Q-BUS-01 | Who is the design-target client: 3–8-room guest house, 10–20-room hotel, homestay cluster? | Sets scale envelope (NFR-PRF-04), UI density, feature priorities | ★ | |
| Q-BUS-02 | Is the Ops Hub sold standalone, or only bundled with the ROOT assistant? | Packaging, onboarding scope, pricing | ★ | |
| Q-BUS-03 | What is the monetisation model and price point (Q3 grant milestone)? | GAP-27; billing tooling; unit economics per deployment | ★ | |
| Q-BUS-04 | What does "scale-readiness" (Q4 milestone) mean measurably to the grant committee? | Converts milestone into acceptance criteria | ★ | |
| Q-BUS-05 | Which 3–5 pilot properties are committed for Q1, and what are their room counts/OTA mix? | Real parser fixtures, iCal availability check, UAT plan | ★ | |
| Q-BUS-06 | Referral credits: is settlement ever monetary, or reciprocity-only? Dispute handling? Peer disconnect? | BR-COM-06; community economics | | |
| Q-BUS-07 | Is there competitive pressure (e.g. eZee, Djubo, local channel managers) at pilot properties today? | Positioning + must-match features | | |

## Operations / Reception
| ID | Question | Why | ★ | Answer |
|----|----------|-----|---|--------|
| Q-OPS-01 | Max advance-booking horizon and max stay length to accept? | Validation bounds (BR-BOOK-10) | | |
| Q-OPS-02 | Can a room with future bookings be archived? What should happen? | BR-BOOK-11 | | |
| Q-OPS-03 | May a guest check out with a balance due (block/warn/allow)? | AMB-09; revenue leakage | ★ | |
| Q-OPS-04 | No-show policy: when marked, charge, refund, effect on reliability score? | AMB-08; shared alerts fairness | ★ | |
| Q-OPS-05 | Is fixed-room-at-booking acceptable at peak, or is type-level booking with assignment at check-in needed? | AMB-03 — deepest structural question in the booking core | ★ | |
| Q-OPS-06 | Groups: is one combined invoice enough, or split billing/deposits per room needed? | AMB-19 | | |
| Q-OPS-07 | Is mid-stay room change (split stay) needed? | Calendar/constraint design | | |
| Q-OPS-08 | Should the app show *why* a price was suggested (rule trace)? Confirm compounding order expectations | AMB-18; owner trust | | |
| Q-OPS-09 | Should attendance link to payroll (salary calc), or is register-keeping enough? | Staff scope boundary | | |
| Q-OPS-10 | How should the app decide a guest is a foreign national (C-Form gate)? | AMB-10; legal miss risk | ★ | |
| Q-OPS-11 | Early check-in / late check-out: charged? how much? | Fee constructs on booking | | |
| Q-OPS-12 | Any midnight/rollover expectations (late-night check-ins count as which day)? | Today board semantics | | |
| Q-OPS-13 | CSV import: expected source formats (old registers? Excel?) and volume? | Import robustness | | |

## Housekeeping
| ID | Question | Why | ★ | Answer |
|----|----------|-----|---|--------|
| Q-HK-01 | Is a supervisor "inspected" step wanted before a room returns to Ready? | GAP-20 | | |
| Q-HK-02 | Are recurring deep-clean/linen-change schedules needed? | GAP-20 | | |
| Q-HK-03 | Should a dirty room be bookable for same-day arrival (warn) or blocked? | Guard rules | | |

## Finance
| ID | Question | Why | ★ | Answer |
|----|----------|-----|---|--------|
| Q-FIN-01 | Commission basis per channel (gross vs net-of-GST)? Does MMT operate net-rate for pilots? Channel+agent stacking arithmetic? | AMB-05; BO-05 accuracy | ★ | |
| Q-FIN-02 | Are pilot properties GST-registered? Required invoice format/series/tax lines? | GAP-11 scope trigger | ★ | |
| Q-FIN-03 | Do owners need OTA payout reconciliation (owed vs received per OTA)? | GAP-13 | | |
| Q-FIN-04 | Payment corrections: edit-in-place acceptable, or void+reversal with audit? | BR-PAY-05 | ★ | |
| Q-FIN-05 | Confirm reception-vs-owner money boundary (record vs view aggregates) | AMB-04; masking design | ★ | |
| Q-FIN-06 | Overpayment: hold as credit, auto-refund, or reject? | BR-PAY-06 | | |
| Q-FIN-07 | Refund base (gross vs paid)? OTA-collect refund recording? | AMB-06 | ★ | |
| Q-FIN-08 | Confirm INR-only; what is the currency setting meant to do? | AMB-11 | | |
| Q-FIN-09 | Finance period semantics: accrual by stay-night vs cash by payment date — which do owners expect? | AMB-07 | ★ | |
| Q-FIN-10 | Expense categories needed? Should maintenance costs auto-post to expenses? | Finance coherence | | |
| Q-FIN-11 | Agent commission settlement: record payments to agents (owed→paid)? | Module B9 | | |

## Management / Reporting
| ID | Question | Why | ★ | Answer |
|----|----------|-----|---|--------|
| Q-MGT-01 | Which reports do owners actually ask their accountant for today? | CSV/report roadmap | | |
| Q-MGT-02 | Wanted alerts digest (daily WhatsApp summary of arrivals/outstanding)? | Notification design | | |
| Q-MGT-03 | Multi-property owners: consolidated cross-property dashboard needed, or per-property enough? | Current design is per-property views | | |

## Technology / Infrastructure
| ID | Question | Why | ★ | Answer |
|----|----------|-----|---|--------|
| Q-INF-01 | Ratify hosting stance: managed cloud (Vercel/Supabase) as default with residency statement, vs DO/in-country option — which is offered to whom? | AMB-01; GAP-28; cost per client | ★ | |
| Q-TEC-04 | What exactly works offline today (write queue? which screens?)? | AMB-02; GAP-25 — field safety | ★ | |
| Q-TEC-05 | Confirm property timezone = IST fixed; server TZ pinning | Date arithmetic | | |
| Q-TEC-06 | iCal re-sync semantics: are removed events released? Partial-feed failure handling? | AMB-17 | ★ | |
| Q-TEC-07 | Community seam: central registry service or peer-to-peer between deployments? | AMB-12; GAP-26 | ★ | |
| Q-TEC-08 | Is the `PushSubscription` model wired to anything? | GAP-14 shortcut if yes | | |
| Q-TEC-09 | Is `PropertySettings` the canonical property root (no separate `Property` model)? | AMB-20; ERD accuracy | | |
| Q-TEC-10 | Per-client cost envelope target (hosting+AI) at pilot pricing? | Unit economics; RSK-28 | | |

## Security
| ID | Question | Why | ★ | Answer |
|----|----------|-----|---|--------|
| Q-SEC-01 | Required password policy / lockout beyond rate-limit? | Auth hardening | | |
| Q-SEC-02 | Is owner 2FA wanted (SMS impractical? TOTP?) | FR-AUTH-7 | | |
| Q-SEC-03 | Session length + revocation on role change/disable — confirm expectations | AMB-21 | | |
| Q-SEC-04 | Who may view/download stored ID documents; is each access logged? | NFR-SEC-08; GAP-15 | ★ | |
| Q-SEC-05 | Accept keyed-hash redesign for shared phone matching (enumeration resistance)? | NFR-SEC-09 | | |

## AI
| ID | Question | Why | ★ | Answer |
|----|----------|-----|---|--------|
| Q-AI-01 | Which guest intents may the assistant complete end-to-end vs always escalate (canonical list)? | Policy baseline; BO-06 | ★ | |
| Q-AI-02 | Quote→book flow: how does the agent choose a room among free units? Race/409 UX for the guest? | Seam behaviour | | |
| Q-AI-03 | Should agent bookings hard-block on scam/blacklist hits (vs human warn-only parity)? | AMB-16 | ★ | |
| Q-AI-04 | Who owns two-way guest threads — assistant UI or hub? | AMB-15; GAP-4 | ★ | |
| Q-AI-05 | Has the security prompt been red-teamed (injection suite)? Results? | RSK-23 | | |
| Q-AI-06 | Review responses: AI-drafted? posted where/how? | Module B8 | | |
| Q-AI-07 | Khasi voice quality: which STT/TTS path, and what's the fallback when it fails? | Pitch promise vs reality | | |

## Localization
| ID | Question | Why | ★ | Answer |
|----|----------|-----|---|--------|
| Q-L10N-01 | Staff console languages needed at pilots (English enough? Khasi wanted?) | GAP-16 priority | ★ | |
| Q-L10N-02 | Guest artefact languages (invoice, messages) per guest? | Template variants (GAP-3) | | |
| Q-L10N-03 | Who validates Khasi translations (terminology consistency)? | Quality of localization | | |

## OTAs
| ID | Question | Why | ★ | Answer |
|----|----------|-----|---|--------|
| Q-OTA-01 | Which OTAs at which pilots, and do their listing types offer iCal? | Sync viability per pilot | ★ | |
| Q-OTA-02 | Can we collect a corpus of real confirmation/modification/cancellation emails per OTA? | Parser tuning (FR-ING-4) + GAP-2 | ★ | |
| Q-OTA-03 | Booking.com virtual-card payouts in use? (PCI: never store card data from emails) | Ingestion redaction rules | | |
| Q-OTA-04 | Appetite to pair one budget channel manager later; which brands are trusted locally? | Future-scope planning | | |

## Legal / Compliance
| ID | Question | Why | ★ | Answer |
|----|----------|-----|---|--------|
| Q-LEG-01 | Between MindBit and client: who is DPDP data fiduciary vs processor? Is there a DPA template? | Contract + breach duties | ★ | |
| Q-LEG-02 | Exact Form C practice at pilots (portal? paper? police station?) — what artefact satisfies it? | GAP-7 design target | ★ | |
| Q-LEG-03 | Community governance: who moderates/verifies/adjudicates shared reports? Where is the registry hosted, under whose name? | RSK-04; AMB-12/14 | ★ | |
| Q-LEG-04 | Guest-registry requirements (all guests' IDs vs lead guest) in Meghalaya? | Check-in capture scope | | |
| Q-LEG-05 | Referral PII: consent script when passing guest name/phone to a peer? | AMB-13 | | |
| Q-LEG-06 | Any state tourism registration/licence data the app should hold per property? | Settings completeness | | |

## Migration / Deployment / Support / Training
| ID | Question | Why | ★ | Answer |
|----|----------|-----|---|--------|
| Q-MIG-01 | What records do pilots keep today (paper registers, Excel), and how much history to import? | CSV import realism | | |
| Q-DEP-01 | Onboarding time budget per property (target hours) and who performs it? | GAP-18 tooling scope | ★ | |
| Q-SUP-01 | Support channel/hours/SLA commitment to pilots; who staffs it? | RSK-29 | ★ | |
| Q-TRN-01 | Training format: in-person, video (Khasi?), printed quick cards? | Adoption plan | | |
| Q-ANL-01 | Do owners want anonymised benchmarks vs peers (occupancy vs region)? Privacy stance? | Future analytics; community value | | |
| Q-INT-01 | Accounting handoff: is CSV enough, or is Tally export wanted soon? | Integration roadmap | | |

**Workshop plan `[R]`:** one 3-hour session with owner+reception covers OPS/FIN/HK; one 2-hour session with MindBit founders covers BUS/INF/LEG/AI; counsel review async for LEG. Answers feed directly into Backlog priorities (doc 14) and re-baselined Roadmap (doc 17).
