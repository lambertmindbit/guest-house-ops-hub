-- GAP-6: per-property iCal sync frequency (hours). Default 24 = the existing daily
-- cadence, so nothing changes until an owner shortens it. Additive column.
ALTER TABLE "property_settings" ADD COLUMN "ical_sync_hours" INTEGER NOT NULL DEFAULT 24;
