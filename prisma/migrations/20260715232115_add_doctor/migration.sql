-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credentials" TEXT,
    "title" TEXT,
    "specialty" TEXT,
    "photoUrl" TEXT,
    "bio" TEXT,
    "education" TEXT[],
    "boardCertifications" TEXT[],
    "languages" TEXT[],
    "acceptingNewPatients" BOOLEAN,
    "sourceUrl" TEXT NOT NULL,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_practiceId_sourceUrl_key" ON "Doctor"("practiceId", "sourceUrl");

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
