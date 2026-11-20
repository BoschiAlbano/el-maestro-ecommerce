-- CreateEnum
CREATE TYPE "MlConnectionStatus" AS ENUM ('CONNECTED', 'NEEDS_RECONNECT');

-- CreateEnum
CREATE TYPE "MlNotificationSource" AS ENUM ('WEBHOOK', 'RECOVERY');

-- CreateEnum
CREATE TYPE "MlNotificationStatus" AS ENUM ('PENDING', 'PROCESSED', 'NO_ACTION', 'FAILED', 'DISCARDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ML_CONNECTED';
ALTER TYPE "AuditAction" ADD VALUE 'ML_DISCONNECTED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ML_RECONEXION';

-- CreateTable
CREATE TABLE "ml_connections" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "mlUserId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "status" "MlConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "statusReason" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connectedByUserId" TEXT NOT NULL,
    "lastRefreshedAt" TIMESTAMP(3),
    "lastNotificationAt" TIMESTAMP(3),
    "lastRecoveryAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ml_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ml_notifications" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "mlUserId" TEXT NOT NULL,
    "source" "MlNotificationSource" NOT NULL,
    "status" "MlNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "ml_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ml_notifications_dedupeKey_key" ON "ml_notifications"("dedupeKey");

-- CreateIndex
CREATE INDEX "ml_notifications_status_receivedAt_idx" ON "ml_notifications"("status", "receivedAt");

-- AddForeignKey
ALTER TABLE "ml_connections" ADD CONSTRAINT "ml_connections_connectedByUserId_fkey" FOREIGN KEY ("connectedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Fila única (specs/019, RF-7): Prisma no expresa esta restricción, va a mano.
ALTER TABLE "ml_connections" ADD CONSTRAINT "ml_connections_singleton_check" CHECK ("id" = 'singleton');
