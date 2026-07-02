-- CreateTable
CREATE TABLE "booking_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "guest_id" TEXT,
    "notes" TEXT,
    "property_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_groups_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN "group_id" TEXT;

-- CreateIndex
CREATE INDEX "reservations_group_id_idx" ON "reservations"("group_id");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "booking_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
