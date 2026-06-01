-- Required for the GiST exclusion constraint below (range + equality in one index).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('confirmed', 'cancelled', 'no_show');

-- CreateTable
CREATE TABLE "room_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_rate" DECIMAL(10,2) NOT NULL,
    "max_occupancy" INTEGER NOT NULL,
    "rate_floor" DECIMAL(10,2) NOT NULL,
    "rate_ceiling" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "room_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "room_type_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commission_pct" DECIMAL(5,2) NOT NULL,
    "collects_payment" BOOLEAN NOT NULL,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "guest_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "ota_ref" TEXT,
    "check_in" DATE NOT NULL,
    "check_out" DATE NOT NULL,
    -- Half-open [check_in, check_out): a checkout and a same-day check-in do NOT overlap.
    "stay" daterange GENERATED ALWAYS AS (daterange("check_in", "check_out", '[)')) STORED,
    "status" "ReservationStatus" NOT NULL DEFAULT 'confirmed',
    "arrival_time" TEXT,
    "special_requests" TEXT,
    "gross_amount" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    -- Half-open [start_date, end_date), same convention as reservations.
    "period" daterange GENERATED ALWAYS AS (daterange("start_date", "end_date", '[)')) STORED,
    "reason" TEXT,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guests_phone_key" ON "guests"("phone");

-- CreateIndex
CREATE INDEX "reservations_room_id_idx" ON "reservations"("room_id");

-- CreateIndex
CREATE INDEX "reservations_guest_id_idx" ON "reservations"("guest_id");

-- CreateIndex
CREATE INDEX "blocks_room_id_idx" ON "blocks"("room_id");

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- THE correctness core: two CONFIRMED reservations for the same physical room
-- can never overlap. Enforced by the database, not app code. Cancelled/no_show
-- rows are excluded from the predicate so they free the dates back up.
-- A violation raises SQLSTATE 23P01 (exclusion_violation), which the API layer
-- catches and turns into a friendly "those dates are no longer available".
ALTER TABLE "reservations"
  ADD CONSTRAINT "no_overlapping_confirmed_stays"
  EXCLUDE USING gist (
    "room_id" WITH =,
    "stay" WITH &&
  ) WHERE ("status" = 'confirmed');
