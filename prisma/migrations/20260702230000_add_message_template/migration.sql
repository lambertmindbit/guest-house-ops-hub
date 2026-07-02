-- Messaging trigger engine (Gap 13). Additive nullable column recording which
-- template produced a message, so scheduled triggers can dedupe by
-- (reservation, template) and never enqueue the same notification twice.
ALTER TABLE "outbound_messages" ADD COLUMN "template" TEXT;
