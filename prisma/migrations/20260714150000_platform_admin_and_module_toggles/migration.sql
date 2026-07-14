-- Platform admin + per-property module visibility.
--
-- Both columns are ADDITIVE with safe defaults, so existing rows and existing
-- code keep behaving exactly as before:
--
--   users.is_platform_admin        DEFAULT false → nobody is a platform admin
--                                  until explicitly granted.
--   property_settings.disabled_modules DEFAULT '{}' → nothing is hidden, i.e.
--                                  today's behaviour. We store what is DISABLED
--                                  rather than what is ENABLED precisely so that
--                                  an empty array (and any new property) shows
--                                  the whole product instead of a blank app.
--
-- Nothing here touches reservations, the generated daterange columns, or the
-- no_overlapping_confirmed_stays exclusion constraint.

ALTER TABLE "users"
  ADD COLUMN "is_platform_admin" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "property_settings"
  ADD COLUMN "disabled_modules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
