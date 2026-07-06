-- Web Push subscriptions for owner notifications. Purely additive: one
-- tenant-scoped table, keyed by the unique push endpoint. No FK into
-- reservations, so the no_overlapping_confirmed_stays GiST constraint is untouched.
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "property_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions" ("endpoint");
