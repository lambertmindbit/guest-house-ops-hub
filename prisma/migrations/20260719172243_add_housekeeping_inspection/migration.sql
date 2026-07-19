-- AlterTable
ALTER TABLE "property_settings" ADD COLUMN     "inspection_required" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "last_inspected_at" TIMESTAMP(3);
