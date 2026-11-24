-- AlterTable
ALTER TABLE "ml_listings" ADD COLUMN     "publishedFromSystem" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ml_orders" ADD COLUMN     "localPickUp" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "mlDefaultListingType" TEXT NOT NULL DEFAULT 'gold_special',
ADD COLUMN     "mlDefaultLocalPickUp" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "mlDefaultWarrantyDays" INTEGER DEFAULT 30,
ADD COLUMN     "mlDefaultWarrantyType" TEXT DEFAULT 'SELLER';

-- CreateTable
CREATE TABLE "ml_publication_data" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "categoryId" TEXT,
    "categoryName" TEXT,
    "suggestedCategoryId" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT NOT NULL DEFAULT '',
    "useProductPhoto" BOOLEAN NOT NULL DEFAULT true,
    "extraPhotoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "listingType" TEXT NOT NULL,
    "warrantyType" TEXT,
    "warrantyDays" INTEGER,
    "localPickUp" BOOLEAN NOT NULL,
    "packageHeightCm" INTEGER,
    "packageWidthCm" INTEGER,
    "packageLengthCm" INTEGER,
    "packageWeightG" INTEGER,
    "emptyGtinReason" TEXT,
    "publishingAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ml_publication_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ml_publication_data_productId_key" ON "ml_publication_data"("productId");

-- AddForeignKey
ALTER TABLE "ml_publication_data" ADD CONSTRAINT "ml_publication_data_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

