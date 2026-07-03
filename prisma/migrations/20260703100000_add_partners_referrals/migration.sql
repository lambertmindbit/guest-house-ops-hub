-- Owner-managed Partners directory + outbound Referral log. Purely additive:
-- one enum + two tenant-scoped tables. No FK into reservations and no generated
-- columns, so the no_overlapping_confirmed_stays GiST constraint is untouched.

-- CreateEnum
CREATE TYPE "ReferralOutcome" AS ENUM ('referred', 'booked', 'declined');

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT,
    "phone" TEXT,
    "locality" TEXT,
    "rating" INTEGER,
    "notes" TEXT,
    "property_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outbound_referrals" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT,
    "guest_name" TEXT NOT NULL,
    "guest_phone" TEXT,
    "check_in" DATE,
    "check_out" DATE,
    "status" "ReferralOutcome" NOT NULL DEFAULT 'referred',
    "note" TEXT,
    "property_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbound_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbound_referrals_partner_id_idx" ON "outbound_referrals"("partner_id");

-- AddForeignKey
ALTER TABLE "outbound_referrals" ADD CONSTRAINT "outbound_referrals_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
