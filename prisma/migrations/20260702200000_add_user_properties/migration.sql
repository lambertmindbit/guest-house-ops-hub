-- Multi-location property switcher (Phase 3, slice i). Additive: one join table
-- linking a user to additional properties they may switch into. The single-
-- property model is unchanged (a user's primary User.property_id still applies).

-- CreateTable
CREATE TABLE "user_properties" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_properties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_properties_user_id_property_id_key" ON "user_properties"("user_id", "property_id");
CREATE INDEX "user_properties_user_id_idx" ON "user_properties"("user_id");
