-- CreateEnum
CREATE TYPE "BlockSource" AS ENUM ('manual', 'ical');

-- AlterTable
-- NOTE: Prisma also generated `ALTER COLUMN "period"/"stay" DROP DEFAULT` for
-- the GENERATED daterange columns; removed by hand — they are GENERATED ALWAYS,
-- not defaulted, so dropping it is unintended and unsafe.
ALTER TABLE "blocks" ADD COLUMN     "external_uid" TEXT,
ADD COLUMN     "feed_id" TEXT,
ADD COLUMN     "source" "BlockSource" NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE "ical_feeds" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_synced_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ical_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ical_feeds_room_id_idx" ON "ical_feeds"("room_id");

-- CreateIndex
CREATE INDEX "blocks_feed_id_idx" ON "blocks"("feed_id");

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_feed_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "ical_feeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ical_feeds" ADD CONSTRAINT "ical_feeds_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
