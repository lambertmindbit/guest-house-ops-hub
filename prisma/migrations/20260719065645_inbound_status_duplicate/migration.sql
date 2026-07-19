-- US-305: a `duplicate` status for inbound OTA emails whose ota_ref already
-- matches a booking or a pending/imported staging item. Additive enum value.
-- AlterEnum
ALTER TYPE "InboundStatus" ADD VALUE 'duplicate';
