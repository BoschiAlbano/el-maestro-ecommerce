-- CreateEnum
CREATE TYPE "SaleChannel" AS ENUM ('LOCAL', 'MERCADO_LIBRE');

-- CreateEnum
CREATE TYPE "MlOrderStatus" AS ENUM ('TO_PREPARE', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'NOT_DELIVERED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'ML_ORDER_RESTOCKED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ML_VENTA';
ALTER TYPE "NotificationType" ADD VALUE 'ML_VENTA_SIN_STOCK';
ALTER TYPE "NotificationType" ADD VALUE 'ML_CANCELACION';
ALTER TYPE "NotificationType" ADD VALUE 'ML_FRAUDE';

-- AlterTable
ALTER TABLE "ml_connections" ADD COLUMN     "lastOrdersFetchAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "channel" "SaleChannel" NOT NULL DEFAULT 'LOCAL',
ALTER COLUMN "shiftId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "mlOrdersStartDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ml_orders" (
    "id" TEXT NOT NULL,
    "mlKey" TEXT NOT NULL,
    "mlOrderIds" TEXT[],
    "mlPackId" TEXT,
    "saleId" TEXT,
    "status" "MlOrderStatus" NOT NULL,
    "mlShipmentId" TEXT,
    "shipmentStatus" TEXT,
    "shipmentSubstatus" TEXT,
    "dispatchDeadline" TIMESTAMP(3),
    "buyerNickname" TEXT NOT NULL,
    "receiverName" TEXT,
    "destinationCity" TEXT,
    "total" DECIMAL(12,2) NOT NULL,
    "mlFee" DECIMAL(12,2) NOT NULL,
    "sellerShippingCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net" DECIMAL(12,2) NOT NULL,
    "outOfStock" BOOLEAN NOT NULL DEFAULT false,
    "fraudRisk" BOOLEAN NOT NULL DEFAULT false,
    "needsReview" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "labelPrintedAt" TIMESTAMP(3),
    "labelPrintedByUserId" TEXT,
    "mlCreatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ml_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ml_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "mlOrderId" TEXT NOT NULL,
    "mlItemId" TEXT NOT NULL,
    "mlVariationId" TEXT,
    "title" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "saleFee" DECIMAL(12,2) NOT NULL,
    "productId" TEXT,
    "saleItemId" TEXT,
    "restockedQuantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ml_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ml_order_events" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "MlOrderStatus" NOT NULL,
    "detail" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ml_order_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ml_orders_mlKey_key" ON "ml_orders"("mlKey");

-- CreateIndex
CREATE UNIQUE INDEX "ml_orders_saleId_key" ON "ml_orders"("saleId");

-- CreateIndex
CREATE INDEX "ml_orders_status_idx" ON "ml_orders"("status");

-- CreateIndex
CREATE INDEX "ml_orders_dispatchDeadline_idx" ON "ml_orders"("dispatchDeadline");

-- CreateIndex
CREATE INDEX "ml_orders_mlShipmentId_idx" ON "ml_orders"("mlShipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ml_order_items_saleItemId_key" ON "ml_order_items"("saleItemId");

-- CreateIndex
CREATE INDEX "ml_order_items_orderId_idx" ON "ml_order_items"("orderId");

-- CreateIndex
CREATE INDEX "ml_order_events_orderId_idx" ON "ml_order_events"("orderId");

-- CreateIndex
CREATE INDEX "sales_channel_createdAt_idx" ON "sales"("channel", "createdAt");

-- AddForeignKey
ALTER TABLE "ml_orders" ADD CONSTRAINT "ml_orders_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ml_orders" ADD CONSTRAINT "ml_orders_labelPrintedByUserId_fkey" FOREIGN KEY ("labelPrintedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ml_order_items" ADD CONSTRAINT "ml_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ml_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ml_order_items" ADD CONSTRAINT "ml_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ml_order_items" ADD CONSTRAINT "ml_order_items_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "sale_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ml_order_events" ADD CONSTRAINT "ml_order_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ml_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Rol y usuario «Sistema» (specs/022, RF-7): las ventas de Mercado Libre quedan a su nombre.
-- Inactivo: no puede iniciar sesión. Identificadores fijos, los mismos que usa el código
-- (`src/lib/mercadolibre/orders/system-user.ts`).
INSERT INTO "roles" ("id", "name", "isOwnerRole", "updatedAt")
VALUES ('00000000-0000-4000-8000-000000000001', 'Sistema', false, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

INSERT INTO "users" ("id", "authUserId", "name", "email", "username", "usernameKey", "active", "roleId", "updatedAt")
VALUES (
  '00000000-0000-4000-8000-000000000002',
  'sistema:mercadolibre',
  'Mercado Libre (automático)',
  'sistema-mercadolibre@el-maestro.invalid',
  'sistema-mercadolibre',
  'sistema-mercadolibre',
  false,
  '00000000-0000-4000-8000-000000000001',
  CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;
