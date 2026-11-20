-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "receiverAddress" TEXT,
ADD COLUMN     "receiverEdited" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ml_orders" ADD COLUMN     "invoiceUploadError" TEXT,
ADD COLUMN     "invoiceUploadedAt" TIMESTAMP(3),
ADD COLUMN     "invoiceUploadingAt" TIMESTAMP(3),
ADD COLUMN     "mlFiscalDocumentId" TEXT,
ADD COLUMN     "preparedAt" TIMESTAMP(3),
ADD COLUMN     "preparedByUserId" TEXT;

