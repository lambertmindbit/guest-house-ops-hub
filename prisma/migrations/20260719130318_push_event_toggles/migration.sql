-- GAP-14: per-event owner web-push toggles (default on).
ALTER TABLE "property_settings"
  ADD COLUMN "push_escalations" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "push_conflicts"   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "push_stale_sync"  BOOLEAN NOT NULL DEFAULT true;
