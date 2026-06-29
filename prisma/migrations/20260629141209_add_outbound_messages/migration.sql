-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('whatsapp', 'sms', 'email', 'manual');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('queued', 'sent', 'failed', 'logged');

-- CreateEnum
CREATE TYPE "MessageSource" AS ENUM ('assistant', 'cab', 'console', 'system');

-- CreateTable
CREATE TABLE "outbound_messages" (
    "id" TEXT NOT NULL,
    "source" "MessageSource" NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "to" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'logged',
    "sent_at" TIMESTAMP(3),
    "error" TEXT,
    "guest_id" TEXT,
    "reservation_id" TEXT,
    "property_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbound_messages_guest_id_created_at_idx" ON "outbound_messages"("guest_id", "created_at");

-- CreateIndex
CREATE INDEX "outbound_messages_reservation_id_idx" ON "outbound_messages"("reservation_id");

-- CreateIndex
CREATE INDEX "outbound_messages_status_created_at_idx" ON "outbound_messages"("status", "created_at");

-- AddForeignKey
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
