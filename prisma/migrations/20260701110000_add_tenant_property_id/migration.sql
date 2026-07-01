-- Multi-tenancy foundation: add nullable property_id to the core tables
-- (additive; backfilled by the next migration). PropertySettings is the tenant root.
ALTER TABLE "room_types" ADD COLUMN "property_id" TEXT;
ALTER TABLE "rooms" ADD COLUMN "property_id" TEXT;
ALTER TABLE "channels" ADD COLUMN "property_id" TEXT;
ALTER TABLE "guests" ADD COLUMN "property_id" TEXT;
ALTER TABLE "reservations" ADD COLUMN "property_id" TEXT;
ALTER TABLE "payments" ADD COLUMN "property_id" TEXT;
ALTER TABLE "blocks" ADD COLUMN "property_id" TEXT;
ALTER TABLE "expenses" ADD COLUMN "property_id" TEXT;
ALTER TABLE "pricing_policy" ADD COLUMN "property_id" TEXT;
ALTER TABLE "seasons" ADD COLUMN "property_id" TEXT;
ALTER TABLE "rate_overrides" ADD COLUMN "property_id" TEXT;
ALTER TABLE "ical_feeds" ADD COLUMN "property_id" TEXT;
ALTER TABLE "inbound_bookings" ADD COLUMN "property_id" TEXT;
ALTER TABLE "flagged_numbers" ADD COLUMN "property_id" TEXT;
