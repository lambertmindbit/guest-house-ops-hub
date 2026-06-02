-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "checked_in_at" TIMESTAMP(3),
ADD COLUMN     "checked_out_at" TIMESTAMP(3);
