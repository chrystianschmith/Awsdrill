-- CreateEnum
CREATE TYPE "ExamResult" AS ENUM ('PASSED', 'FAILED');

-- CreateTable
CREATE TABLE "UserCertification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "certificationId" TEXT NOT NULL,
    "examCode" TEXT,
    "result" "ExamResult" NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "scaledScore" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "badgeUrl" TEXT,
    "reminderStage" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCertification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserCertification_userId_idx" ON "UserCertification"("userId");

-- CreateIndex
CREATE INDEX "UserCertification_expiresAt_idx" ON "UserCertification"("expiresAt");

-- AddForeignKey
ALTER TABLE "UserCertification" ADD CONSTRAINT "UserCertification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCertification" ADD CONSTRAINT "UserCertification_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
