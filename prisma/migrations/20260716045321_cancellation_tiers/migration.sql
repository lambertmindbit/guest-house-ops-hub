-- Cancellation refund ladder (G2). Replaces the binary free-window (two int
-- columns) with an ordered JSON tier list [{minDaysBefore, refundPct}]. Config
-- only — the two dropped columns held a free-cancel-days number the owner
-- re-expresses as the first tier. No transactional data is touched.

-- AlterTable
ALTER TABLE "cancellation_policy" DROP COLUMN "free_cancel_days_default",
DROP COLUMN "free_cancel_days_peak",
ADD COLUMN     "tiers" JSONB NOT NULL DEFAULT '[]';
