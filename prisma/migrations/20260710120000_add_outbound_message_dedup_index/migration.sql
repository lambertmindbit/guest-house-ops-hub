-- De-duplicate lifecycle messages at the DB level: at most one message per
-- (reservation_id, template). This is the atomic guarantee behind the trigger
-- de-dup (the app-level check-then-write could race). Free-form messages have a
-- null template and/or reservation and are unaffected (Postgres treats NULLs as
-- distinct in a unique index).
--
-- Self-healing: delete any pre-existing duplicate rows first (keeping the
-- earliest per pair) so creating the unique index can't fail on historical data.
-- These are outbox LOG rows, so pruning duplicates is safe.
DELETE FROM "outbound_messages" a
USING "outbound_messages" b
WHERE a."template" IS NOT NULL
  AND a."reservation_id" IS NOT NULL
  AND a."template" = b."template"
  AND a."reservation_id" = b."reservation_id"
  -- (created_at, id) is strictly orderable and unique (id is a cuid), so exactly
  -- one row per pair survives even if two share the same timestamp.
  AND (a."created_at", a."id") > (b."created_at", b."id");

CREATE UNIQUE INDEX "outbound_messages_reservation_template_key"
  ON "outbound_messages" ("reservation_id", "template")
  WHERE "template" IS NOT NULL AND "reservation_id" IS NOT NULL;
