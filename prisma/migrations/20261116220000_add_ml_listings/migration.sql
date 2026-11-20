-- CreateEnum
CREATE TYPE "PriceChangeSource" AS ENUM ('USER', 'MERCADO_LIBRE');

-- CreateEnum
CREATE TYPE "MlListingStatus" AS ENUM ('ACTIVE', 'PAUSED', 'PAUSED_NO_STOCK', 'UNDER_REVIEW', 'CLOSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ML_LISTING_LINKED';
ALTER TYPE "AuditAction" ADD VALUE 'ML_LISTING_UNLINKED';
ALTER TYPE "AuditAction" ADD VALUE 'ML_LISTING_PAUSED';
ALTER TYPE "AuditAction" ADD VALUE 'ML_LISTING_ACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE 'ML_LISTING_CLOSED';

-- AlterEnum
ALTER TYPE "ModuloNegocio" ADD VALUE 'MERCADO_LIBRE';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ML_PUBLICACION';

-- AlterTable
ALTER TABLE "product_price_history" ADD COLUMN     "source" "PriceChangeSource" NOT NULL DEFAULT 'USER',
ALTER COLUMN "changedByUserId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "sku" TEXT,
ADD COLUMN     "skuKey" TEXT;

-- CreateTable
CREATE TABLE "ml_listings" (
    "id" TEXT NOT NULL,
    "mlItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "linkedProductId" TEXT,
    "title" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "permalink" TEXT NOT NULL,
    "categoryId" TEXT,
    "status" "MlListingStatus" NOT NULL,
    "mlStatus" TEXT NOT NULL,
    "mlSubStatus" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "statusReason" TEXT,
    "lastKnownPrice" DECIMAL(12,2) NOT NULL,
    "lastKnownSku" TEXT,
    "skuConflict" TEXT,
    "pricePendingSince" TIMESTAMP(3),
    "pausePendingSince" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "lastReadAt" TIMESTAMP(3),
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkedByUserId" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ml_listings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ml_listings_mlItemId_key" ON "ml_listings"("mlItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ml_listings_linkedProductId_key" ON "ml_listings"("linkedProductId");

-- CreateIndex
CREATE INDEX "ml_listings_status_idx" ON "ml_listings"("status");

-- CreateIndex
CREATE INDEX "ml_listings_pricePendingSince_idx" ON "ml_listings"("pricePendingSince");

-- CreateIndex
CREATE UNIQUE INDEX "products_skuKey_key" ON "products"("skuKey");

-- AddForeignKey
ALTER TABLE "ml_listings" ADD CONSTRAINT "ml_listings_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ml_listings" ADD CONSTRAINT "ml_listings_linkedProductId_fkey" FOREIGN KEY ("linkedProductId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ml_listings" ADD CONSTRAINT "ml_listings_linkedByUserId_fkey" FOREIGN KEY ("linkedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

