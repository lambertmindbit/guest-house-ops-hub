# Testing Readiness
## Discovery doc 16 · v1.0 · 2026-07-16

Existing automated coverage `[FACT]`: conflict/availability core + pure pricing (Vitest, real test DB required), agent pytest suite + CI. Known holes `[FACT]`: route handlers, quoteRoomType wrapper, housekeeping derivation. Scenario IDs (TS-*) are referenced by the RTM.

## 1. Functional test scenarios — the correctness core (regression-critical)
| ID | Scenario | Type |
|----|----------|------|
| TS-BK-01 | Create overlapping confirmed booking same room → 409, friendly message, nothing persisted | Negative / **route-level (US-903)** |
| TS-BK-02 | Back-to-back stays (checkout day = next check-in) succeed | Boundary |
| TS-BK-03 | Overlap allowed when existing is cancelled/no_show | Functional |
| TS-BK-04 | Concurrent create race: exactly one wins (parallel requests) | Concurrency |
| TS-BK-05 | Edit dates into an overlap → 409; original untouched | Negative |
| TS-BK-06 | checkOut ≤ checkIn rejected; absurd ranges per Q-OPS-01 bounds | Boundary |
| TS-BK-07 | Guest dedupe: same phone reuses record; new phone creates | Functional |
| TS-AV-01 | Availability = units − confirmed − blocks across span | Unit (exists) |
| TS-AV-02 | Cancel frees dates instantly | Functional |
| TS-AV-03 | Archived room excluded from availability, history intact | Functional |
| TS-AV-04 | Block overlapping stay → conflict flagged, not blocked write | Functional |
| TS-AV-05 | Raw-SQL availability respects property scope (leak test) | Security |
| TS-IC-01..07 | Import creates blocks; export serves busy; stale-feed warning; frequency config; buffer withheld; removed-event releases block; per-feed token rotation | Sync suite |
| TS-IN-01..07 | Paste-parse happy; unparseable staged raw; webhook token reject; modification diff/apply; cancellation flow; wrong-ref mismatch alert; duplicate ref suppressed | Ingestion suite |

## 2. Money & finance
| ID | Scenario |
|----|----------|
| TS-PY-01 | Part-payments accumulate; balance derived correctly |
| TS-PY-02 | UPI/bank without full checklist → save disabled (fake-payment guard) |
| TS-PY-03 | Advance pending → received on advance-tagged payment |
| TS-PY-04 | UPI link/QR equals current balance after each payment |
| TS-PY-05 | Refund ladder tiers at each boundary (30/20/7-day edges) |
| TS-PY-06 | Owner overrides refund amount; audited |
| TS-PY-07 | Paise arithmetic property tests (no float drift) after US-401 |
| TS-PY-08 | Void+reversal keeps balance & audit consistent |
| TS-PY-09 | Refund > paid rejected (BR-CANC-03) |
| TS-PY-10 | Razorpay webhook replay → single posting (idempotency) |
| TS-PY-11 | Hold expiry releases room; constraint intact |
| TS-FN-01..07 | Net = gross−commission−expenses; channel vs agent stacking per ratified rule; date-semantics labels; CSV reconciliation totals; invoice numbering gap-free per FY; GST lines per rate; payout variance report |

## 3. Check-in / compliance
| ID | Scenario |
|----|----------|
| TS-CI-01 | ID gate blocks check-in until ID recorded (strictness=block); warn and off modes behave |
| TS-CI-02 | Undo steps back exactly one stage |
| TS-CI-03 | Checkout → housekeeping task appears (US-904) |
| TS-CI-04 | Foreign guest without C-Form blocked; artefact renders complete (US-201) |
| TS-CI-05 | Form C 24h reminder fires; submitted flag audited |
| TS-PR-01..04 | Guest export completeness; erasure removes PII yet preserves financial rows; retention purge deletes on schedule; consent required before ID storage |

## 4. Security tests
| ID | Scenario |
|----|----------|
| TS-SC-01 | Login rate-limit lockout (and shared-store behaviour once added) |
| TS-SC-02 | Agent seam without/with-wrong token → 401, fail-closed, no info leak |
| TS-SC-03 | Ingest webhook token + oversized payload rejection |
| TS-SC-04 | Reception role: money fields absent from every API response (contract test per role) |
| TS-SC-05 | RLS: cross-property query via raw SQL contained |
| TS-SC-06 | Hashed-phone enumeration resistance (keyed hash) |
| TS-SC-07 | ID-document access logged; unsigned URL access denied |
| TS-SC-08 | Prompt-injection suite vs assistant (Q-AI-05): exfiltration, tool-abuse, policy-override attempts |
| TS-SC-09 | Session revoked on disable/role change (per Q-SEC-03) |

## 5. Community suite
TS-CM-01 nothing shared before grant; TS-CM-02 per-type grant honoured exactly; TS-CM-03 referral books via conflict-checked path & credits derive; TS-CM-04 report requires evidence, expires on schedule; TS-CM-05 dispute/appeal transitions; TS-CM-06 PII/occupancy/finance never present in seam payloads (contract test).

## 6. Offline / PWA (after US-901 spec)
TS-OF-01 airplane-mode write queued and syncs; TS-OF-02 offline booking that conflicts surfaces the documented UX; TS-OF-03 no silent drop on cache eviction; TS-OF-04 2G field script (Today load, booking create timings vs NFR-PRF).

## 7. Notifications & messaging
TS-NT-01 high-severity escalation push ≤ 1 min, deep-link; TS-NT-02 toggles respected; TS-MS-01 template send with params per language; TS-MS-02 24h-window rule respected; TS-MS-03 opt-out honoured; TS-MS-04 quiet hours; TS-MS-05 inbound reply appears in thread.

## 8. Ops acceptance
TS-OP-01 scripted client provision < 2h to bookable; TS-OP-02 wizard completes unaided; TS-OP-03 staged fleet upgrade halts on canary failure; TS-OP-04 version/health dashboard truthfulness; TS-OP-05 offboarding export completeness; TS-OP-06 backup produced nightly + offsite; TS-OP-07 quarterly restore drill meets RTO; TS-OP-08 synthetic error reaches monitoring in 5 min.

## 9. UAT scenarios (pilot, run with real staff)
1. Full guest lifecycle: WhatsApp enquiry → AI or manual booking → advance via QR → arrival ID gate → in-stay complaint → checkout with invoice → cleaning → review request.
2. OTA morning routine: paste (or auto-receive) 3 real Booking.com emails incl. 1 modification → all correctly on calendar.
3. Cross-channel drill: simulate OTA iCal block landing on a direct booking → owner resolves via WF-12 playbook.
4. Owner money week: expenses, agent commissions, refund approval, CSV to accountant — accountant confirms usability.
5. Housekeeping day on a phone in the field (patchy signal).
6. Escalation at night → morning push → resolve.
7. Multi-property owner switches properties; verifies no bleed of bookings/finance; shared guest recognised.
8. Community: connect two pilots, share vendors + referral, complete a referral end-to-end.

## 10. Performance & boundary
Load at NFR-PRF-04 envelope (60 rooms, 30k reservations/yr synthetic): calendar month P95 < 2s; booking P95 < 1.5s; agent availability P95 < 800ms. Boundary: 365-night stay, 100-room property (should degrade gracefully with clear stance), 0-room property (empty states), season boundaries, FY rollover for invoice series, DST-irrelevance check (IST).

## 11. Accessibility
TS-AC-01 contrast audit core screens (both themes); TS-AC-02 touch targets ≥ 44px on tab bar/FAB/row actions; TS-AC-03 screen-reader labels on booking form & payments.

## 12. Regression areas (protect on every release)
The GiST constraint path + db-errors sniffing; availability derivation; refund ladder math; tenancy scoping; seam auth; iCal round-trip; pricing clamp. These are the modules where a regression costs a client real money or a legal duty.
