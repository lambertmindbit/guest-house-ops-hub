-- GAP-7: track when a foreign guest's Form C was filed for an arrival.
ALTER TABLE "reservations" ADD COLUMN "form_c_submitted_at" TIMESTAMP(3);
