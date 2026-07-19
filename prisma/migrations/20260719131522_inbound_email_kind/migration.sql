-- GAP-2: classify inbound OTA emails as new / modification / cancellation.
-- CreateEnum
CREATE TYPE "InboundKind" AS ENUM ('new', 'modification', 'cancellation');

-- AlterTable
ALTER TABLE "inbound_bookings" ADD COLUMN "email_kind" "InboundKind" NOT NULL DEFAULT 'new';
