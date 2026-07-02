-- ID-document retention (Gap 12). Purely additive nullable columns: when the
-- current ID document was uploaded, and how many days to keep it before the
-- retention purge deletes it (null = keep indefinitely).

ALTER TABLE "guests" ADD COLUMN "id_uploaded_at" TIMESTAMP(3);
ALTER TABLE "property_settings" ADD COLUMN "id_retention_days" INTEGER;
