-- Structured payload on escalations (e.g. a booking request's room/dates/guest),
-- so the owner UI can offer a direct action ("Approve & book") instead of forcing
-- a re-type from prose. Purely additive: one nullable jsonb column. No FK into
-- reservations, so the no_overlapping_confirmed_stays GiST constraint is untouched.
ALTER TABLE "escalations" ADD COLUMN "metadata" JSONB;
