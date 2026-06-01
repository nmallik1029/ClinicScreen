-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "token" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "sessionsValidFrom" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Device_token_key" ON "Device"("token");
