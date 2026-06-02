-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "archived_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "property_settings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'My Guest House',
    "check_in_time" TEXT NOT NULL DEFAULT '14:00',
    "check_out_time" TEXT NOT NULL DEFAULT '11:00',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "address" TEXT,
    "gst_number" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_settings_pkey" PRIMARY KEY ("id")
);
