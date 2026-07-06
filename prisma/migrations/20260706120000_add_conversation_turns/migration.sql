-- Assistant conversation log: one row per turn (user message + assistant reply),
-- for the owner to review. Purely additive: one tenant-scoped table. No FK into
-- reservations, so the no_overlapping_confirmed_stays GiST constraint is untouched.
CREATE TABLE "conversation_turns" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "user_message" TEXT NOT NULL,
    "reply" TEXT NOT NULL,
    "property_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_turns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "conversation_turns_session_id_idx" ON "conversation_turns" ("session_id");
CREATE INDEX "conversation_turns_created_at_idx" ON "conversation_turns" ("created_at");
