-- Backfill property_id to the single existing property (the sole property_settings
-- row) so pre-tenancy data stays visible under tenant scoping. No-op on an empty DB.
UPDATE "room_types" SET "property_id" = (SELECT "id" FROM "property_settings" ORDER BY "updated_at" ASC LIMIT 1) WHERE "property_id" IS NULL;
UPDATE "rooms" SET "property_id" = (SELECT "id" FROM "property_settings" ORDER BY "updated_at" ASC LIMIT 1) WHERE "property_id" IS NULL;
UPDATE "channels" SET "property_id" = (SELECT "id" FROM "property_settings" ORDER BY "updated_at" ASC LIMIT 1) WHERE "property_id" IS NULL;
UPDATE "guests" SET "property_id" = (SELECT "id" FROM "property_settings" ORDER BY "updated_at" ASC LIMIT 1) WHERE "property_id" IS NULL;
UPDATE "reservations" SET "property_id" = (SELECT "id" FROM "property_settings" ORDER BY "updated_at" ASC LIMIT 1) WHERE "property_id" IS NULL;
UPDATE "payments" SET "property_id" = (SELECT "id" FROM "property_settings" ORDER BY "updated_at" ASC LIMIT 1) WHERE "property_id" IS NULL;
UPDATE "blocks" SET "property_id" = (SELECT "id" FROM "property_settings" ORDER BY "updated_at" ASC LIMIT 1) WHERE "property_id" IS NULL;
UPDATE "expenses" SET "property_id" = (SELECT "id" FROM "property_settings" ORDER BY "updated_at" ASC LIMIT 1) WHERE "property_id" IS NULL;
UPDATE "pricing_policy" SET "property_id" = (SELECT "id" FROM "property_settings" ORDER BY "updated_at" ASC LIMIT 1) WHERE "property_id" IS NULL;
UPDATE "seasons" SET "property_id" = (SELECT "id" FROM "property_settings" ORDER BY "updated_at" ASC LIMIT 1) WHERE "property_id" IS NULL;
UPDATE "rate_overrides" SET "property_id" = (SELECT "id" FROM "property_settings" ORDER BY "updated_at" ASC LIMIT 1) WHERE "property_id" IS NULL;
UPDATE "ical_feeds" SET "property_id" = (SELECT "id" FROM "property_settings" ORDER BY "updated_at" ASC LIMIT 1) WHERE "property_id" IS NULL;
UPDATE "inbound_bookings" SET "property_id" = (SELECT "id" FROM "property_settings" ORDER BY "updated_at" ASC LIMIT 1) WHERE "property_id" IS NULL;
UPDATE "flagged_numbers" SET "property_id" = (SELECT "id" FROM "property_settings" ORDER BY "updated_at" ASC LIMIT 1) WHERE "property_id" IS NULL;
UPDATE "escalations" SET "property_id" = (SELECT "id" FROM "property_settings" ORDER BY "updated_at" ASC LIMIT 1) WHERE "property_id" IS NULL;
UPDATE "outbound_messages" SET "property_id" = (SELECT "id" FROM "property_settings" ORDER BY "updated_at" ASC LIMIT 1) WHERE "property_id" IS NULL;
UPDATE "complaints" SET "property_id" = (SELECT "id" FROM "property_settings" ORDER BY "updated_at" ASC LIMIT 1) WHERE "property_id" IS NULL;
UPDATE "refunds" SET "property_id" = (SELECT "id" FROM "property_settings" ORDER BY "updated_at" ASC LIMIT 1) WHERE "property_id" IS NULL;
UPDATE "cancellation_policy" SET "property_id" = (SELECT "id" FROM "property_settings" ORDER BY "updated_at" ASC LIMIT 1) WHERE "property_id" IS NULL;
