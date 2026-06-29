-- CreateEnum
CREATE TYPE "EscalationSource" AS ENUM ('assistant', 'cab', 'console', 'manual');

-- CreateEnum
CREATE TYPE "EscalationCategory" AS ENUM ('customer', 'driver', 'booking', 'payment', 'maintenance', 'other');

-- CreateEnum
CREATE TYPE "EscalationSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "EscalationStatus" AS ENUM ('open', 'in_progress', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "EscalationRelatedType" AS ENUM ('reservation', 'guest', 'trip', 'none');

-- CreateTable
CREATE TABLE "escalations" (
    "id" TEXT NOT NULL,
    "source" "EscalationSource" NOT NULL,
    "category" "EscalationCategory" NOT NULL DEFAULT 'other',
    "severity" "EscalationSeverity" NOT NULL DEFAULT 'medium',
    "status" "EscalationStatus" NOT NULL DEFAULT 'open',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "reason" TEXT,
    "raised_by_name" TEXT,
    "raised_by_contact" TEXT,
    "raised_by_lang" TEXT,
    "original_text" TEXT,
    "translated_text" TEXT,
    "related_type" "EscalationRelatedType" NOT NULL DEFAULT 'none',
    "related_id" TEXT,
    "thread_ref" TEXT,
    "external_id" TEXT,
    "assigned_to" TEXT,
    "first_response_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "property_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escalations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "escalations_external_id_key" ON "escalations"("external_id");

-- CreateIndex
CREATE INDEX "escalations_status_severity_created_at_idx" ON "escalations"("status", "severity", "created_at");

-- CreateIndex
CREATE INDEX "escalations_category_status_idx" ON "escalations"("category", "status");
