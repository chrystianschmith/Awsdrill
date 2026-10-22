-- CreateEnum
CREATE TYPE "CatalogRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- AlterTable
ALTER TABLE "Domain" ADD COLUMN     "retiredAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CatalogRun" (
    "id" TEXT NOT NULL,
    "status" "CatalogRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "examsChecked" INTEGER NOT NULL DEFAULT 0,
    "examsUnchanged" INTEGER NOT NULL DEFAULT 0,
    "examsPublished" INTEGER NOT NULL DEFAULT 0,
    "examsModeration" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "CatalogRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogReview" (
    "id" TEXT NOT NULL,
    "runId" TEXT,
    "examCode" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "diff" JSONB NOT NULL,
    "confidence" DECIMAL(3,2) NOT NULL,
    "problems" JSONB NOT NULL DEFAULT '[]',
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "CatalogReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogRun_startedAt_idx" ON "CatalogRun"("startedAt");

-- CreateIndex
CREATE INDEX "CatalogReview_status_createdAt_idx" ON "CatalogReview"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogReview_examCode_payloadHash_key" ON "CatalogReview"("examCode", "payloadHash");

-- AddForeignKey
ALTER TABLE "CatalogReview" ADD CONSTRAINT "CatalogReview_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CatalogRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
