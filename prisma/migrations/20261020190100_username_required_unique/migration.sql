-- AlterTable
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL,
ALTER COLUMN "usernameKey" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_usernameKey_key" ON "users"("usernameKey");
