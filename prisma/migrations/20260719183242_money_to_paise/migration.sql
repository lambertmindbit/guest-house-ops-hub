-- GAP-9/US-401: migrate all money from DECIMAL(10,2) rupees to BIGINT integer paise.
-- Each column is converted in place with `USING round("col" * 100)` so existing
-- rupee values become paise (₹2000.00 → 200000), preserving every value exactly
-- (a bare cast would truncate to whole rupees, losing the ×100). NULLs stay NULL.
--
-- NOTE: this is deliberately hand-authored (see scripts/migrate.mjs). The spurious
-- `ALTER COLUMN "stay" DROP DEFAULT` Prisma emitted for the generated daterange
-- column is omitted so the no_overlapping_confirmed_stays exclusion constraint's
-- dependency is untouched.

-- AlterTable
ALTER TABLE "expenses" ALTER COLUMN "amount" SET DATA TYPE BIGINT USING round("amount" * 100)::bigint;

-- AlterTable
ALTER TABLE "inbound_bookings" ALTER COLUMN "amount" SET DATA TYPE BIGINT USING round("amount" * 100)::bigint;

-- AlterTable
ALTER TABLE "maintenance_requests" ALTER COLUMN "cost" SET DATA TYPE BIGINT USING round("cost" * 100)::bigint;

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "amount" SET DATA TYPE BIGINT USING round("amount" * 100)::bigint;

-- AlterTable
ALTER TABLE "payouts" ALTER COLUMN "amount" SET DATA TYPE BIGINT USING round("amount" * 100)::bigint;

-- AlterTable
ALTER TABLE "purchase_orders" ALTER COLUMN "amount" SET DATA TYPE BIGINT USING round("amount" * 100)::bigint;

-- AlterTable
ALTER TABLE "rate_overrides" ALTER COLUMN "rate" SET DATA TYPE BIGINT USING round("rate" * 100)::bigint;

-- AlterTable
ALTER TABLE "referral_credit_entries" ALTER COLUMN "amount" SET DATA TYPE BIGINT USING round("amount" * 100)::bigint;

-- AlterTable
ALTER TABLE "referrals" ALTER COLUMN "attributed_revenue" SET DATA TYPE BIGINT USING round("attributed_revenue" * 100)::bigint;

-- AlterTable
ALTER TABLE "refunds" ALTER COLUMN "amount" SET DATA TYPE BIGINT USING round("amount" * 100)::bigint;

-- AlterTable
ALTER TABLE "reservations"
  ALTER COLUMN "gross_amount" SET DATA TYPE BIGINT USING round("gross_amount" * 100)::bigint,
  ALTER COLUMN "advance_required" SET DATA TYPE BIGINT USING round("advance_required" * 100)::bigint;

-- AlterTable
ALTER TABLE "room_types"
  ALTER COLUMN "base_rate" SET DATA TYPE BIGINT USING round("base_rate" * 100)::bigint,
  ALTER COLUMN "rate_floor" SET DATA TYPE BIGINT USING round("rate_floor" * 100)::bigint,
  ALTER COLUMN "rate_ceiling" SET DATA TYPE BIGINT USING round("rate_ceiling" * 100)::bigint;

-- AlterTable
ALTER TABLE "tour_bookings" ALTER COLUMN "amount" SET DATA TYPE BIGINT USING round("amount" * 100)::bigint;

-- AlterTable
ALTER TABLE "tours" ALTER COLUMN "price" SET DATA TYPE BIGINT USING round("price" * 100)::bigint;

-- AlterTable
ALTER TABLE "trips" ALTER COLUMN "fare" SET DATA TYPE BIGINT USING round("fare" * 100)::bigint;

-- AlterTable
ALTER TABLE "vendor_payments" ALTER COLUMN "amount" SET DATA TYPE BIGINT USING round("amount" * 100)::bigint;
