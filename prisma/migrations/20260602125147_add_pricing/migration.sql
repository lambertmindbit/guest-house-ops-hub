-- CreateTable
CREATE TABLE "pricing_policy" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "weekend_days" INTEGER[] DEFAULT ARRAY[5, 6]::INTEGER[],
    "weekend_adjust_pct" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "lead_early_days" INTEGER,
    "lead_early_adjust_pct" DECIMAL(6,2),
    "lead_late_days" INTEGER,
    "lead_late_adjust_pct" DECIMAL(6,2),
    "occupancy_threshold_pct" INTEGER,
    "occupancy_adjust_pct" DECIMAL(6,2),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "adjust_pct" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_overrides" (
    "id" TEXT NOT NULL,
    "room_type_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "rate_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rate_overrides_room_type_id_date_key" ON "rate_overrides"("room_type_id", "date");
