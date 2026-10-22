-- CreateEnum
CREATE TYPE "CertLevel" AS ENUM ('FOUNDATIONAL', 'ASSOCIATE', 'PROFESSIONAL', 'SPECIALTY');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('BETA', 'ACTIVE', 'RETIRING', 'RETIRED');

-- CreateEnum
CREATE TYPE "PublishState" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DataStatus" AS ENUM ('OFFICIAL', 'A_CONFIRMAR');

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "CertLevel" NOT NULL,
    "trackOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamVersion" (
    "id" TEXT NOT NULL,
    "certificationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "ExamStatus" NOT NULL,
    "questionCount" INTEGER,
    "scoredQuestions" INTEGER,
    "durationMinutes" INTEGER,
    "passingScore" INTEGER,
    "priceUsd" DECIMAL(8,2),
    "validityMonths" INTEGER NOT NULL DEFAULT 36,
    "launchedAt" TIMESTAMP(3),
    "retiresAt" TIMESTAMP(3),
    "sourceUrl" TEXT NOT NULL,
    "infoUrl" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "dataStatus" "DataStatus" NOT NULL DEFAULT 'A_CONFIRMAR',
    "publishState" "PublishState" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL,
    "examVersionId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "namePt" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlueprintWeight" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "weightPct" DECIMAL(5,2),
    "sourceUrl" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "dataStatus" "DataStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlueprintWeight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Certification_slug_key" ON "Certification"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ExamVersion_code_key" ON "ExamVersion"("code");

-- CreateIndex
CREATE INDEX "ExamVersion_certificationId_status_idx" ON "ExamVersion"("certificationId", "status");

-- CreateIndex
CREATE INDEX "Domain_parentId_idx" ON "Domain"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Domain_examVersionId_code_key" ON "Domain"("examVersionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "BlueprintWeight_domainId_revision_key" ON "BlueprintWeight"("domainId", "revision");

-- AddForeignKey
ALTER TABLE "ExamVersion" ADD CONSTRAINT "ExamVersion_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_examVersionId_fkey" FOREIGN KEY ("examVersionId") REFERENCES "ExamVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlueprintWeight" ADD CONSTRAINT "BlueprintWeight_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
