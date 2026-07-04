-- Optimistic-concurrency token for reservations (audit L-4). Additive: one
-- non-null column with a constant default (fast, no table rewrite in PG11+).
-- Not part of the no_overlapping_confirmed_stays exclusion constraint or the
-- generated `stay` column, so the correctness core is untouched.
ALTER TABLE "reservations" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
