# Requirement Traceability Matrix (RTM)
## Discovery doc 15 · v1.0 · 2026-07-16

Chain: **Business Objective (BO, doc 01) → Requirement (FR/NFR, doc 02) → Business Rules (BR, doc 05) → Gap (doc 06) → Story (US, doc 14) → Test scenario (TS, doc 16)**. Baseline-✅ requirements trace to regression scenarios; delta items trace to stories. Import-ready single table.

| BO | Requirement | Rules | Gap | Story | Test |
|----|-------------|-------|-----|-------|------|
| BO-01 | FR-BOOK-1..5 | BR-BOOK-01..08 | — | baseline (+US-903) | TS-BK-01..07 |
| BO-01 | FR-ING-1..3 | BR-OTA-01/02 | — | baseline | TS-IN-01..03 |
| BO-01 | FR-ING-5 (mods/cancels) | BR-OTA-04 | GAP-2 | US-301 | TS-IN-04..06 |
| BO-01 | FR-ING-6 (dedupe) | BR-OTA-03 | — | US-305 | TS-IN-07 |
| BO-02 | FR-AVAIL-1..4 | BR-BOOK-01/03, BR-AVL-02 | — | baseline (+US-903/904) | TS-AV-01..05 |
| BO-02 | FR-ICAL-1..2 | BR-AVL-01/03 | — | baseline | TS-IC-01..02 |
| BO-02 | FR-ICAL-3/6 (health, freq) | BR-AVL-05 | GAP-5/6 | US-104, US-303 | TS-IC-03..04 |
| BO-02 | FR-AVAIL-5 (buffer) | BR-AVL-06 | GAP-24 | US-304 | TS-IC-05 |
| BO-02 | FR-ICAL-4 (release) | — | AMB-17 | (Q-TEC-06→story) | TS-IC-06 |
| BO-03/06 | FR-AGT-1..4/6 | BR-AI-01..04 | — | baseline | TS-AG-01..05 |
| BO-06 | FR-AGT-5 (notify) | BR-AI-05 | GAP-14 | US-501 | TS-NT-01..02 |
| BO-03 | FR-MSG-1..3 | — | GAP-3 | US-502, US-504 | TS-MS-01..04 |
| BO-03 | FR-MSG-5 | — | GAP-4 | US-503 | TS-MS-05 |
| BO-05 | FR-PAY-1..4/6 | BR-PAY-01..04, BR-CANC-01/02 | — | baseline | TS-PY-01..06 |
| BO-05 | FR-PAY-7/8 | BR-PAY-05/07 | GAP-9 | US-401, US-404 | TS-PY-07..09 |
| BO-05 | FR-PAY-5 (gateway) | BR-PAY-08 | — | US-407 | TS-PY-10..11 |
| BO-05 | FIN commission truth | BR-FIN-01..03/05 | AMB-05/07 | US-406 (+answers) | TS-FN-01..04 |
| BO-05 | Invoice compliance | BR-FIN-06 | GAP-11 | US-205/206 | TS-FN-05..06 |
| BO-05 | OTA payout recon | — | GAP-13 | US-405 | TS-FN-07 |
| BO-05 | Money masking | BR-FIN-04 | GAP-12 | US-402/403 | TS-SC-04..05 |
| BO-07 | NFR-PRV-01 (DPDP) | BR-GST-04/05 | GAP-8 | US-202/203/204 | TS-PR-01..04 |
| BO-07 | NFR-PRV-02 (Form C) | BR-CHK-02/04 | GAP-7 | US-201 | TS-CI-04..05 |
| BO-07 | GAP-23 export | — | GAP-23 | US-704 | TS-OP-05 |
| BO-07 | AMB-01 residency | — | GAP-28 | US-902-adjacent (statement) | — |
| BO-08 | FR-COM (community) | BR-COM-01..05 | — | baseline | TS-CM-01..05 |
| BO-08 | Governance/topology | BR-COM-06 | GAP-26 | US-902 | TS-CM-06 |
| BO-08 | Hash strength | BR-COM-04 | — | US-605 | TS-SC-06 |
| BO-09 | Fleet ops | — | GAP-18/30 | US-105/701/702/703/706 | TS-OP-01..04 |
| BO-09 | Backup/restore | — | GAP-1 | US-101/102 | TS-OP-06..07 |
| BO-09 | Observability | — | GAP-17 | US-103 | TS-OP-08 |
| BO-09 | Onboarding auth | — | GAP-10 | US-601/602/603 | TS-AU-01..05 |
| BO-10 | Billing | — | GAP-27 | US-705 | — (process) |
| BO-06/inclusion | FR-L10N-1/2 | — | GAP-16 | US-801/802 | TS-LN-01..02 |
| Quality | NFR-UX-03 | — | GAP-21 | US-803 | TS-AC-01..03 |
| Field reality | Offline (B15) | — | GAP-25 | US-901 | TS-OF-01..04 |
| CRM integrity | FR-GST-1 (merge) | — | GAP-19 | US-907 | TS-GD-05 |
| Check-in legal | FR/BR-CHK-01..03 | — | — | baseline | TS-CI-01..03 |
| Housekeeping | BR-HK-01..04 | — | GAP-20 | US-904 (+Q-HK) | TS-HK-01..03 |
| Pricing | BR-PRC-01..05 | — | AMB-18 | (doc answer) | TS-PR-R01..03 |
| Security misc | NFR-SEC-05/06 | — | — | US-606 (+Upstash cond.) | TS-SC-01..03 |
| ID docs | NFR-SEC-08 | — | GAP-15 | US-604 | TS-SC-07 |
| iCal tokens | — | — | — | US-906 | TS-IC-07 |
| Product stance | BR-BOOK-09 | — | GAP-29 | US-905 | — (decision) |

**Coverage check:** every GAP-1…GAP-30 traces to ≥1 story or an explicit decision/answer path (GAP-22 → doc 17 Phase 3 scope; GAP-28 → residency statement action in doc 17). Every P0 story traces back to a BO. Orphan check re-run after stakeholder answers.
