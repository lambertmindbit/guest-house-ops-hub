-- Owner-editable assistant guidance per topic (intent), injected into the agent
-- prompt at runtime so an owner can steer the assistant without a deploy. Purely
-- additive: one tenant-scoped table. No FK into reservations, so the
-- no_overlapping_confirmed_stays GiST constraint is untouched.
CREATE TABLE "assistant_policies" (
    "id" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "autonomous" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "property_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_policies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "assistant_policies_intent_idx" ON "assistant_policies" ("intent");
