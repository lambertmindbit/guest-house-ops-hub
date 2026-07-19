-- AlterTable
ALTER TABLE "shared_guest_alerts" ADD COLUMN     "hash_version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "shared_scam_reports" ADD COLUMN     "hash_version" INTEGER NOT NULL DEFAULT 1;
