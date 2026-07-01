-- CreateEnum
CREATE TYPE "ComplaintCategory" AS ENUM ('maintenance', 'cleanliness', 'food', 'noise', 'staff', 'billing', 'other');

-- CreateEnum
CREATE TYPE "ComplaintPriority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('open', 'in_progress', 'resolved');

-- CreateTable
CREATE TABLE "complaints" (
    "id" TEXT NOT NULL,
    "guest_id" TEXT,
    "reservation_id" TEXT,
    "category" "ComplaintCategory" NOT NULL DEFAULT 'other',
    "priority" "ComplaintPriority" NOT NULL DEFAULT 'medium',
    "status" "ComplaintStatus" NOT NULL DEFAULT 'open',
    "assignee" TEXT,
    "description" TEXT NOT NULL,
    "resolution_note" TEXT,
    "satisfaction" INTEGER,
    "escalation_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "property_id" TEXT,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "complaints_status_priority_created_at_idx" ON "complaints"("status", "priority", "created_at");

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
