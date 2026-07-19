-- GAP-11/US-205: statutory tax invoices. Purely additive — two new tables plus two
-- nullable columns on property_settings. No existing column is altered, so the
-- no_overlapping_confirmed_stays exclusion constraint is untouched by construction.

-- AlterTable: per-property invoicing config (series prefix + editable GST slabs).
ALTER TABLE "property_settings"
  ADD COLUMN "gst_slabs" JSONB,
  ADD COLUMN "invoice_prefix" TEXT;

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "financial_year" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMP(3),
    "property_name" TEXT NOT NULL,
    "property_address" TEXT,
    "property_gstin" TEXT,
    "guest_name" TEXT NOT NULL,
    "guest_phone" TEXT,
    "nights" INTEGER NOT NULL,
    "tax_rate_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxable_paise" BIGINT NOT NULL,
    "cgst_paise" BIGINT NOT NULL DEFAULT 0,
    "sgst_paise" BIGINT NOT NULL DEFAULT 0,
    "round_off_paise" BIGINT NOT NULL DEFAULT 0,
    "total_paise" BIGINT NOT NULL,
    "paid_paise" BIGINT NOT NULL DEFAULT 0,
    "property_id" TEXT,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unit_paise" BIGINT NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "property_id" TEXT,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoices_reservation_id_idx" ON "invoices"("reservation_id");

-- CreateIndex: the numbering guarantee — a consecutive series per property per
-- financial year. Two concurrent issues cannot take the same seq.
CREATE UNIQUE INDEX "invoices_property_id_financial_year_seq_key" ON "invoices"("property_id", "financial_year", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_property_id_number_key" ON "invoices"("property_id", "number");

-- CreateIndex
CREATE INDEX "invoice_lines_invoice_id_idx" ON "invoice_lines"("invoice_id");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
