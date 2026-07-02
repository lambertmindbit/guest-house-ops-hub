-- Tours & activities (Gap 7). Purely additive: one enum + three tenant-scoped
-- tables. No FK into reservations and no generated columns, so the
-- no_overlapping_confirmed_stays GiST constraint is untouched.

-- CreateEnum
CREATE TYPE "TourStatus" AS ENUM ('planned', 'confirmed', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "tour_partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "commission_pct" INTEGER,
    "property_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tour_partners_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tours" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2),
    "partner_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "property_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tours_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tour_bookings" (
    "id" TEXT NOT NULL,
    "tour_id" TEXT NOT NULL,
    "partner_id" TEXT,
    "guest_id" TEXT,
    "reservation_id" TEXT,
    "date" DATE,
    "amount" DECIMAL(10,2),
    "commission_pct" INTEGER,
    "status" "TourStatus" NOT NULL DEFAULT 'planned',
    "note" TEXT,
    "property_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tour_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tour_bookings_tour_id_idx" ON "tour_bookings"("tour_id");

-- AddForeignKey
ALTER TABLE "tours" ADD CONSTRAINT "tours_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "tour_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tour_bookings" ADD CONSTRAINT "tour_bookings_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tour_bookings" ADD CONSTRAINT "tour_bookings_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "tour_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
