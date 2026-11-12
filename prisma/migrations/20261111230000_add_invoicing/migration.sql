-- CreateEnum
CREATE TYPE "FiscalEnvironment" AS ENUM ('HOMOLOGACION', 'PRODUCCION');

-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('FACTURA_C', 'NOTA_CREDITO_C');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "InvoiceOrigin" AS ENUM ('LOCAL', 'MERCADO_LIBRE');

-- CreateEnum
CREATE TYPE "ReceiverDocType" AS ENUM ('NONE', 'DNI', 'CUIT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'FISCAL_CONFIG_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'ARCA_CERTIFICATE_UPDATED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'TOPE_FACTURACION';

-- CreateTable
CREATE TABLE "fiscal_config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "razonSocial" TEXT NOT NULL DEFAULT '',
    "cuit" TEXT NOT NULL DEFAULT '',
    "domicilioComercial" TEXT NOT NULL DEFAULT '',
    "iibb" TEXT NOT NULL DEFAULT '',
    "inicioActividades" DATE,
    "puntoDeVenta" INTEGER,
    "environment" "FiscalEnvironment" NOT NULL DEFAULT 'HOMOLOGACION',
    "topeAnual" DECIMAL(14,2),
    "montoIdentificacion" DECIMAL(14,2) NOT NULL DEFAULT 10000000,
    "diasParaFacturar" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arca_credentials" (
    "environment" "FiscalEnvironment" NOT NULL,
    "certificatePem" TEXT,
    "privateKeyEnc" TEXT,
    "pendingKeyEnc" TEXT,
    "pendingCsrPem" TEXT,
    "cuit" TEXT,
    "expiresAt" TIMESTAMP(3),
    "uploadedByUserId" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arca_credentials_pkey" PRIMARY KEY ("environment")
);

-- CreateTable
CREATE TABLE "arca_tickets" (
    "environment" "FiscalEnvironment" NOT NULL,
    "service" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "payloadEnc" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arca_tickets_pkey" PRIMARY KEY ("environment","service")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "kind" "InvoiceKind" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "environment" "FiscalEnvironment" NOT NULL,
    "origin" "InvoiceOrigin" NOT NULL DEFAULT 'LOCAL',
    "saleId" TEXT NOT NULL,
    "relatedInvoiceId" TEXT,
    "pointOfSale" INTEGER NOT NULL,
    "number" INTEGER,
    "attemptedNumber" INTEGER,
    "cae" TEXT,
    "caeExpiresAt" DATE,
    "issueDate" DATE,
    "total" DECIMAL(12,2) NOT NULL,
    "receiverDocType" "ReceiverDocType" NOT NULL DEFAULT 'NONE',
    "receiverDocNumber" TEXT,
    "receiverName" TEXT,
    "receiverIvaCondition" INTEGER NOT NULL,
    "emitterSnapshot" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorizedAt" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoices_saleId_idx" ON "invoices"("saleId");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_createdAt_idx" ON "invoices"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_environment_pointOfSale_kind_number_key" ON "invoices"("environment", "pointOfSale", "kind", "number");

-- AddForeignKey
ALTER TABLE "arca_credentials" ADD CONSTRAINT "arca_credentials_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_relatedInvoiceId_fkey" FOREIGN KEY ("relatedInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Restricciones que Prisma no expresa (specs/023, plan sección 1). Van a mano.

-- Fila única de configuración fiscal.
ALTER TABLE "fiscal_config" ADD CONSTRAINT "fiscal_config_singleton_check" CHECK ("id" = 'singleton');

-- Una factura por venta (RF-14). Las descartadas no cuentan.
CREATE UNIQUE INDEX "invoices_one_factura_per_sale" ON "invoices"("saleId") WHERE "kind" = 'FACTURA_C' AND "status" <> 'DISCARDED';

-- Una nota de crédito por factura.
CREATE UNIQUE INDEX "invoices_one_credit_note_per_invoice" ON "invoices"("relatedInvoiceId") WHERE "status" <> 'DISCARDED';

-- Una nota de crédito siempre apunta a su factura, y una factura a ninguna.
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_related_invoice_check" CHECK (("kind" = 'NOTA_CREDITO_C') = ("relatedInvoiceId" IS NOT NULL));

-- Autorizado implica número, código de autorización y fecha.
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_authorized_complete_check" CHECK ("status" <> 'AUTHORIZED' OR ("number" IS NOT NULL AND "cae" IS NOT NULL AND "issueDate" IS NOT NULL));
