-- GAP-24: oversell safety buffer per room type. Additive column with a default of 0
-- (no behaviour change until set). No existing column altered — the
-- no_overlapping_confirmed_stays exclusion constraint is untouched by construction.

-- AlterTable
ALTER TABLE "room_types" ADD COLUMN     "oversell_buffer" INTEGER NOT NULL DEFAULT 0;
