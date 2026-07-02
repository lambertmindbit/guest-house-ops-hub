-- Overflow referral marketplace (Phase 3, slice d). Purely additive: one enum +
-- two cross-tenant tables. Touches nothing in the correctness core; a resulting
-- booking is created the normal guarded way and only linked here.

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('proposed', 'accepted', 'declined', 'expired', 'converted');

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "from_property_id" TEXT NOT NULL,
    "to_property_id" TEXT NOT NULL,
    "guest_name" TEXT NOT NULL,
    "guest_phone" TEXT,
    "check_in" DATE NOT NULL,
    "check_out" DATE NOT NULL,
    "room_type_need" TEXT,
    "note" TEXT,
    "status" "ReferralStatus" NOT NULL DEFAULT 'proposed',
    "resulting_reservation_id" TEXT,
    "attributed_revenue" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "referral_credit_entries" (
    "id" TEXT NOT NULL,
    "from_property_id" TEXT NOT NULL,
    "to_property_id" TEXT NOT NULL,
    "referral_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_credit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "referrals_to_property_id_idx" ON "referrals"("to_property_id");
CREATE INDEX "referrals_from_property_id_idx" ON "referrals"("from_property_id");
CREATE INDEX "referral_credit_entries_from_property_id_idx" ON "referral_credit_entries"("from_property_id");
CREATE INDEX "referral_credit_entries_to_property_id_idx" ON "referral_credit_entries"("to_property_id");
