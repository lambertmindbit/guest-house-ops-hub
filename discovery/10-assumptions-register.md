# Assumptions Register
## Discovery doc 10 · v1.0 · 2026-07-16

| ID | Assumption | Impact if held | Validation required | Risk if incorrect |
|----|------------|----------------|---------------------|-------------------|
| ASM-01 | Property operates in a single timezone (IST); dates are property-local | All date arithmetic simple | Confirm server/client TZ pinning in code | Off-by-one stays around midnight; wrong Today board |
| ASM-02 | INR is the only real currency; "currency" setting is display-only | UPI/GST/₹ features safe | Q-FIN-08 | Multi-currency illusion misleads a client |
| ASM-03 | Phone number is a reliable unique guest key | Dedupe, scam-matching, community hashing all work | Field data on shared/changed phones | Fractured guest history; false scam matches |
| ASM-04 | Each physical room maps 1:1 to one OTA listing unit for iCal | iCal protects against oversell | Per-pilot listing audit (Q-OTA-01) | Residual oversell despite sync |
| ASM-05 | Owners can operate an English console until localization lands | GAP-16 can be Should not Must | Pilot observation (Q-L10N-01) | Adoption failure at less-English-literate pilots |
| ASM-06 | Staff smartphones: mid/low-end Android, intermittent 4G | Perf/offline targets | Device survey at pilots | UX unusable in field |
| ASM-07 | README/ROADMAP accurately describe what's built | This package's ✅ statuses valid | Iteration-2 code audit | Statuses wrong → plan wrong |
| ASM-08 | Supabase platform backups exist and are restorable | GAP-1 is procedure, not capability | Restore drill | Data-loss exposure worse than assessed |
| ASM-09 | Meta will approve transactional WhatsApp templates (confirmation/reminder) incl. Khasi text | Messaging plan viable | Early template submission | Messaging value prop delayed |
| ASM-10 | OTA confirmation emails reach the owner's own inbox for all pilot OTA listings | Ingestion viable | Q-BUS-05 pilot check | Inbox flow useless for some pilots |
| ASM-11 | Gemini/Cloud Run terms permit guest PII processing with notice; costs stay within unit economics | AI stack stable | ToS/cost review (Q-TEC-10) | Re-platform assistant |
| ASM-12 | Guests consent to ID storage at check-in when asked | ID gate workable | Consent script + pilot feedback | Check-in friction; legal exposure |
| ASM-13 | One-deployment-per-client remains the isolation model (no shared multi-client SaaS) | Fleet tooling is the scaling answer | Founders ratify | Different architecture path entirely |
| ASM-14 | Community features run on a MindBit-operated shared registry `[I — topology unconfirmed]` | Governance/legal design target | Q-TEC-07 | Governance design invalid |
| ASM-15 | Pilot properties are ≤ ~20 rooms, ≤ ~5 properties/owner | Perf envelope (NFR-PRF-04) | Q-BUS-01 | Perf/N+1 issues surface |
| ASM-16 | The grant's Q3 "monetisation" milestone can be satisfied with manual billing + pricing sheet | GAP-27 scope small in-year | Grant committee expectations (Q-BUS-04) | Product billing needed sooner |
| ASM-17 | Form C obligations at pilots are satisfiable with a printed/pre-filled artefact + manual portal entry | GAP-7 scope bounded | Q-LEG-02 | Deeper e-filing integration needed |
| ASM-18 | No PCI-scope data is stored (card entries are mode-labels only; OTA virtual cards never persisted) | Avoids PCI burden | Code + ingestion redaction check (Q-OTA-03) | PCI scope accidentally acquired |
