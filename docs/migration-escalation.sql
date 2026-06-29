-- ───────────────────────────────────────────────────────────────────────────
-- REFERENCE ONLY — the equivalent SQL `npm run db:migrate:new add_escalations`
-- should produce. Do NOT hand-apply this; generate it through the safe helper
-- so the migration is recorded in prisma/migrations and the exclusion-constraint
-- verification runs. Shown here only so you can eyeball the diff.
--
-- Purely additive: new enum types + one new table. Nothing touches the
-- reservations/blocks generated columns or the GiST constraint.
-- ───────────────────────────────────────────────────────────────────────────

CREATE TYPE "EscalationSource"      AS ENUM ('assistant','cab','console','manual');
CREATE TYPE "EscalationCategory"    AS ENUM ('customer','driver','booking','payment','maintenance','other');
CREATE TYPE "EscalationSeverity"    AS ENUM ('low','medium','high','critical');
CREATE TYPE "EscalationStatus"      AS ENUM ('open','in_progress','resolved','dismissed');
CREATE TYPE "EscalationRelatedType" AS ENUM ('reservation','guest','trip','none');

CREATE TABLE "escalations" (
  "id"                TEXT NOT NULL,
  "source"            "EscalationSource"      NOT NULL,
  "category"          "EscalationCategory"    NOT NULL DEFAULT 'other',
  "severity"          "EscalationSeverity"    NOT NULL DEFAULT 'medium',
  "status"            "EscalationStatus"      NOT NULL DEFAULT 'open',
  "title"             TEXT NOT NULL,
  "summary"           TEXT NOT NULL,
  "reason"            TEXT,
  "raised_by_name"    TEXT,
  "raised_by_contact" TEXT,
  "raised_by_lang"    TEXT,
  "original_text"     TEXT,
  "translated_text"   TEXT,
  "related_type"      "EscalationRelatedType" NOT NULL DEFAULT 'none',
  "related_id"        TEXT,
  "thread_ref"        TEXT,
  "external_id"       TEXT,
  "assigned_to"       TEXT,
  "first_response_at" TIMESTAMP(3),
  "resolved_at"       TIMESTAMP(3),
  "resolution_note"   TEXT,
  "property_id"       TEXT,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "escalations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "escalations_external_id_key" ON "escalations"("external_id");
CREATE INDEX "escalations_status_severity_created_at_idx" ON "escalations"("status","severity","created_at");
CREATE INDEX "escalations_category_status_idx" ON "escalations"("category","status");
