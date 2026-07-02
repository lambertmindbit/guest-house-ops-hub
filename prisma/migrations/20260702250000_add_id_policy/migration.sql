-- Configurable ID-collection policy (Gap 12 follow-on). Additive columns with
-- defaults matching the current behaviour: hard block at check-in ('block'), ID
-- not required at booking creation. Nothing touches the correctness core.
ALTER TABLE "property_settings"
  ADD COLUMN "id_policy" TEXT NOT NULL DEFAULT 'block',
  ADD COLUMN "id_required_at_booking" BOOLEAN NOT NULL DEFAULT false;
