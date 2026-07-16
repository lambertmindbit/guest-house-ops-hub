-- Travel agents (G3). An inbound B2B agent you owe `commission_pct` of the room
-- rate; commission owed is derived from a booking's gross_amount, never stored.
-- Purely additive: a nullable reservations.agent_id + the agents table. The
-- no-double-booking exclusion constraint is untouched.

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "agent_id" TEXT;

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "commission_pct" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "verified_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "property_id" TEXT,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservations_agent_id_idx" ON "reservations"("agent_id");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
