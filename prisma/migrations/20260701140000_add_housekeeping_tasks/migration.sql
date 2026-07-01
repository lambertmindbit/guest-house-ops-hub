-- CreateEnum
CREATE TYPE "HkTaskStatus" AS ENUM ('pending', 'in_progress', 'done');

-- CreateTable
CREATE TABLE "housekeeping_tasks" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "assignee_staff_id" TEXT,
    "status" "HkTaskStatus" NOT NULL DEFAULT 'pending',
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "completed_by_staff_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "note" TEXT,
    "property_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "housekeeping_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "housekeeping_tasks_room_id_date_key" ON "housekeeping_tasks"("room_id", "date");
CREATE INDEX "housekeeping_tasks_date_idx" ON "housekeeping_tasks"("date");

-- AddForeignKey
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
