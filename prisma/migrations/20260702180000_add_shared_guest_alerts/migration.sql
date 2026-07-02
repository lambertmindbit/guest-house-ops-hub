-- Community bad-guest alerts (Phase 3, slice f). Purely additive: two enums + one
-- cross-tenant table. Built on the per-property Guest blacklist (unchanged);
-- guest phones stored HASHED (data minimisation). Correctness core untouched.

-- CreateEnum
CREATE TYPE "GuestAlertStatus" AS ENUM ('submitted', 'verified', 'disputed', 'rejected');
CREATE TYPE "GuestAlertCategory" AS ENUM ('damage', 'disturbance', 'rule_breach', 'threat', 'other');

-- CreateTable
CREATE TABLE "shared_guest_alerts" (
    "id" TEXT NOT NULL,
    "reporter_property_id" TEXT NOT NULL,
    "guest_phone_hash" TEXT NOT NULL,
    "guest_phone_last4" TEXT,
    "guest_name_masked" TEXT,
    "category" "GuestAlertCategory" NOT NULL DEFAULT 'other',
    "reason" TEXT NOT NULL,
    "evidence_note" TEXT,
    "evidence_paths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" "GuestAlertStatus" NOT NULL DEFAULT 'submitted',
    "created_by_user_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_guest_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shared_guest_alerts_guest_phone_hash_idx" ON "shared_guest_alerts"("guest_phone_hash");
CREATE INDEX "shared_guest_alerts_reporter_property_id_idx" ON "shared_guest_alerts"("reporter_property_id");
