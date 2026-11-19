-- AlterTable
ALTER TABLE "ml_listings" ADD COLUMN     "lastKnownQuantity" INTEGER,
ADD COLUMN     "lastQuantitySyncAt" TIMESTAMP(3),
ADD COLUMN     "quantityPendingSince" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ml_listings_quantityPendingSince_idx" ON "ml_listings"("quantityPendingSince");

