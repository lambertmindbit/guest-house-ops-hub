-- GAP-22: per-night rate breakdown snapshot on bookings. Additive nullable JSONB
-- column; no existing column altered, so the no_overlapping_confirmed_stays
-- exclusion constraint is untouched by construction.

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "nightly_rates" JSONB;
