-- Community network foundation (Phase 3, slice a). Purely additive: new nullable
-- columns on the tenant-root property_settings, two new cross-tenant tables, and
-- two enums. Touches nothing in the correctness core (reservations/blocks
-- generated columns or the no_overlapping_confirmed_stays GiST constraint).

-- AlterTable: community directory profile on the property (tenant root)
ALTER TABLE "property_settings"
  ADD COLUMN "public_name" TEXT,
  ADD COLUMN "bio" TEXT,
  ADD COLUMN "locality" TEXT,
  ADD COLUMN "contact_phone" TEXT,
  ADD COLUMN "photo_paths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "price_band" TEXT,
  ADD COLUMN "lat" DOUBLE PRECISION,
  ADD COLUMN "lng" DOUBLE PRECISION,
  ADD COLUMN "is_discoverable" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('pending', 'accepted', 'declined', 'revoked');
CREATE TYPE "ShareType" AS ENUM ('availability', 'referrals', 'scam', 'bad_guest', 'vendors', 'transport');

-- CreateTable
CREATE TABLE "network_connections" (
    "id" TEXT NOT NULL,
    "requester_property_id" TEXT NOT NULL,
    "addressee_property_id" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "network_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sharing_grants" (
    "id" TEXT NOT NULL,
    "grantor_property_id" TEXT NOT NULL,
    "grantee_property_id" TEXT NOT NULL,
    "data_type" "ShareType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sharing_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "network_connections_requester_addressee_key" ON "network_connections"("requester_property_id", "addressee_property_id");
CREATE INDEX "network_connections_addressee_property_id_idx" ON "network_connections"("addressee_property_id");
CREATE UNIQUE INDEX "sharing_grants_grantor_grantee_type_key" ON "sharing_grants"("grantor_property_id", "grantee_property_id", "data_type");
CREATE INDEX "sharing_grants_grantee_property_id_idx" ON "sharing_grants"("grantee_property_id");
