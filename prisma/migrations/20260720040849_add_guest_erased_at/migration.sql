-- GAP-8/US-202: DPDP erasure marker. Additive single nullable column; the guest row
-- itself always survives erasure so bookings, invoices and finance stay intact.
-- No existing column altered — the no_overlapping_confirmed_stays constraint is
-- untouched by construction.

-- AlterTable
ALTER TABLE "guests" ADD COLUMN     "erased_at" TIMESTAMP(3);
