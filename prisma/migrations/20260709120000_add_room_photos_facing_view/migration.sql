-- Guest-facing room content: photo URLs (owner-pasted, same pattern as
-- faq_entries.media), and free-text facing/view the owner authors per room.
-- Purely additive: three nullable columns.
ALTER TABLE "rooms" ADD COLUMN "photos" JSONB;
ALTER TABLE "rooms" ADD COLUMN "facing" TEXT;
ALTER TABLE "rooms" ADD COLUMN "view" TEXT;
