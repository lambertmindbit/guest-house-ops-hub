-- BR-GST-05: new properties default to a 180-day ID-scan retention window. Only
-- changes the column default — existing rows are untouched (keep NULL/indefinite
-- or whatever the owner set).
ALTER TABLE "property_settings" ALTER COLUMN "id_retention_days" SET DEFAULT 180;
