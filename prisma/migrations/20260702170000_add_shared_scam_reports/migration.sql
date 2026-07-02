-- Community scam network (Phase 3, slice e). Purely additive: one enum + one
-- cross-tenant table. The private per-property flagged_numbers list is untouched;
-- phones here are stored HASHED (data minimisation). Nothing in the correctness
-- core is affected.

-- CreateEnum
CREATE TYPE "ScamReportStatus" AS ENUM ('submitted', 'verified', 'disputed', 'rejected');

-- CreateTable
CREATE TABLE "shared_scam_reports" (
    "id" TEXT NOT NULL,
    "reporter_property_id" TEXT NOT NULL,
    "phone_hash" TEXT NOT NULL,
    "phone_last4" TEXT,
    "reason" TEXT NOT NULL,
    "evidence_note" TEXT,
    "status" "ScamReportStatus" NOT NULL DEFAULT 'submitted',
    "created_by_user_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_scam_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shared_scam_reports_phone_hash_idx" ON "shared_scam_reports"("phone_hash");
CREATE INDEX "shared_scam_reports_reporter_property_id_idx" ON "shared_scam_reports"("reporter_property_id");
