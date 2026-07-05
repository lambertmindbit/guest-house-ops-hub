-- Owner-managed FAQ for the guest assistant. Purely additive: one tenant-scoped
-- table. No FK into reservations, so the no_overlapping_confirmed_stays GiST
-- constraint is untouched.
CREATE TABLE "faq_entries" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "property_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faq_entries_pkey" PRIMARY KEY ("id")
);
