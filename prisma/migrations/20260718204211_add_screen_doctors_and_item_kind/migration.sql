-- CreateEnum
CREATE TYPE "DoctorMode" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "PlaylistItemKind" AS ENUM ('MEDIA', 'DOCTOR');

-- DropForeignKey
ALTER TABLE "PlaylistItem" DROP CONSTRAINT "PlaylistItem_mediaId_fkey";

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "doctorDurationSeconds" INTEGER,
ADD COLUMN     "doctorIntervalMinutes" INTEGER,
ADD COLUMN     "doctorMode" "DoctorMode" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "PlaylistItem" ADD COLUMN     "doctorId" TEXT,
ADD COLUMN     "kind" "PlaylistItemKind" NOT NULL DEFAULT 'MEDIA',
ALTER COLUMN "mediaId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "_ScreenDoctors" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ScreenDoctors_AB_unique" ON "_ScreenDoctors"("A", "B");

-- CreateIndex
CREATE INDEX "_ScreenDoctors_B_index" ON "_ScreenDoctors"("B");

-- AddForeignKey
ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ScreenDoctors" ADD CONSTRAINT "_ScreenDoctors_A_fkey" FOREIGN KEY ("A") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ScreenDoctors" ADD CONSTRAINT "_ScreenDoctors_B_fkey" FOREIGN KEY ("B") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
