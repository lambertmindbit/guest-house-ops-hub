# Dependencies Register
## Discovery doc 11 · v1.0 · 2026-07-16

## Internal (within ROOT/MindBit)
| ID | Dependency | Consumer | Nature | Risk note |
|----|------------|----------|--------|-----------|
| DEP-I1 | Assistant sidecar (Python ADK+Gemini, Cloud Run) | Escalations, guest chat, messages | Service via `AGENT_TOKEN` seam | Contract versioning needed |
| DEP-I2 | ROOT cab-dispatch module | Transport records context | Out-of-hub service | Records-only boundary must hold |
| DEP-I3 | Community registry seam (topology TBD) | All community features | Cross-deployment | GAP-26 |
| DEP-I4 | Email forwarders (`integrations/`: Gmail Apps Script, CF Email Worker) | Ingestion automation | Deployed per client | Silent-failure monitoring (GAP-5) |

## External services / third parties
| ID | Dependency | Used for | Failure/exposure |
|----|------------|----------|------------------|
| DEP-E1 | Supabase (Postgres, storage, backups) | Primary DB; ID-document bucket | Pricing/limits ×25 clients; residency (AMB-01) |
| DEP-E2 | Vercel (+Cron) | Hosting, scheduled jobs | Cron reliability; serverless rate-limit weakness |
| DEP-E3 | Google Gemini / Cloud Run | AI assistant | Cost, ToS, PII transfer (RSK-25); fallback model exists |
| DEP-E4 | Meta WhatsApp Cloud API | Guest messaging | Template approval, number bans (RSK-15) |
| DEP-E5 | Razorpay | Gateway capture + holds | Merchant KYC lead time; webhook idempotency |
| DEP-E6 | UPI rails (NPCI deep links/QR) | No-gateway payments | Format changes rare; verification stays manual |
| DEP-E7 | GitHub Actions | CI | Low risk |
| DEP-E8 | Sentry/monitoring vendor (proposed) | GAP-17 | To select |
| DEP-E9 | Upstash/Redis (proposed) | Shared rate-limit store | Only when PUBLIC_CHAT on |

## OTA dependencies
| ID | Dependency | Notes |
|----|------------|-------|
| DEP-O1 | Booking.com / Agoda / MMT confirmation-email formats | No contract; drift monitored via fixtures (RSK-13) |
| DEP-O2 | OTA iCal endpoints (availability varies by listing type) | May be absent or withdrawn (RSK-14) |
| DEP-O3 | OTA extranets (manual updates by owner) | Human dependency; never automated (hard rule) |

## Government / regulatory
| ID | Dependency | Notes |
|----|------------|-------|
| DEP-G1 | FRRO / Form C process (local practice at pilots) | Q-LEG-02 defines integration artefact |
| DEP-G2 | GST regime (rates, invoice rules) | GAP-11; accountant validation |
| DEP-G3 | DPDP Act 2023 rules & timelines | GAP-8 programme |
| DEP-G4 | Meghalaya tourism registration (if any) | Q-LEG-06 |

## Messaging / email providers
| ID | Dependency | Notes |
|----|------------|-------|
| DEP-M1 | Owner's Gmail (ingestion source) | Apps Script quotas; or CF Worker w/ branded domain |
| DEP-M2 | Transactional email provider (proposed — invites/reset, GAP-10) | To select |

## Browser / device
| ID | Dependency | Notes |
|----|------------|-------|
| DEP-B1 | PWA capabilities on Android Chrome + iOS Safari | iOS push/install quirks affect GAP-14 design |
| DEP-B2 | Browser print engine | Invoice PDF quality until server-side PDFs |

## Infrastructure / tooling
| ID | Dependency | Notes |
|----|------------|-------|
| DEP-N1 | Prisma + safe-migration helper (`db:migrate:new`) | Load-bearing; never bypass (RSK-09) |
| DEP-N2 | Postgres `btree_gist` + DATERANGE | Core constraint substrate |
| DEP-N3 | DigitalOcean branch (`deploy/digitalocean`) | Residency hedge (AMB-01) |
| DEP-N4 | Node 22 / Next.js 15 lifecycle | Upgrade cadence for fleet |
