-- CreateEnum
CREATE TYPE "InboundStatus" AS ENUM ('pending', 'imported', 'dismissed');

-- CreateTable
CREATE TABLE "inbound_bookings" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "ota_ref" TEXT,
    "raw_text" TEXT NOT NULL,
    "guest_name" TEXT,
    "guest_phone" TEXT,
    "check_in" DATE,
    "check_out" DATE,
    "room_type_hint" TEXT,
    "amount" DECIMAL(10,2),
    "status" "InboundStatus" NOT NULL DEFAULT 'pending',
    "reservation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inbound_bookings_status_idx" ON "inbound_bookings"("status");
