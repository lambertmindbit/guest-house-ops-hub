-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'sent', 'received', 'responded');

-- CreateTable
CREATE TABLE "review_requests" (
    "id" TEXT NOT NULL,
    "guest_id" TEXT,
    "reservation_id" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'Google',
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "rating" INTEGER,
    "link" TEXT,
    "response_draft" TEXT,
    "property_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_requests_status_created_at_idx" ON "review_requests"("status", "created_at");
