-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('open', 'in_progress', 'done');
CREATE TYPE "MaintenancePriority" AS ENUM ('low', 'medium', 'high');

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "room_id" TEXT,
    "preventive_every_days" INTEGER,
    "last_serviced_at" DATE,
    "property_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_requests" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "asset_id" TEXT,
    "room_id" TEXT,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'open',
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'medium',
    "assignee_staff_id" TEXT,
    "vendor_id" TEXT,
    "cost" DECIMAL(10,2),
    "photo_paths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "property_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "maintenance_requests_status_priority_created_at_idx" ON "maintenance_requests"("status", "priority", "created_at");
