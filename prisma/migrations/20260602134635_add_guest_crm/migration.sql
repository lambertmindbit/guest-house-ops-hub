-- AlterTable
ALTER TABLE "guests" ADD COLUMN     "block_reason" TEXT,
ADD COLUMN     "blocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "id_number" TEXT;

