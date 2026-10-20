-- AlterTable
ALTER TABLE "settings" ADD COLUMN "stockAlertDismissedIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
