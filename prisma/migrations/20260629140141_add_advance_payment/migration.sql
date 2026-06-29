-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "is_advance" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "advance_required" DECIMAL(10,2);
