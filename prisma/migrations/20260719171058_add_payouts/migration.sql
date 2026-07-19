-- CreateTable
CREATE TABLE "payouts" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paid_at" DATE NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "property_id" TEXT,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payouts_channel_id_idx" ON "payouts"("channel_id");

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
