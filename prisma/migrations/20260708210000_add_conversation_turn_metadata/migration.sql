-- Optional per-turn diagnostics on the assistant chat log (which tools ran, a
-- token count, whether the fallback model answered). Purely additive: one
-- nullable jsonb column. No FK into reservations, so the exclusion constraint is
-- untouched.
ALTER TABLE "conversation_turns" ADD COLUMN "metadata" JSONB;
