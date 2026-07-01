-- AlterTable: additive guest-record completion (all nullable / defaulted).
ALTER TABLE "guests" ADD COLUMN     "id_checked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "id_photocopied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "id_uploaded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "id_verification_completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "address" TEXT,
ADD COLUMN     "vehicle_number" TEXT,
ADD COLUMN     "emergency_contact_name" TEXT,
ADD COLUMN     "emergency_contact_phone" TEXT,
ADD COLUMN     "preferences" TEXT[] DEFAULT ARRAY[]::TEXT[];
