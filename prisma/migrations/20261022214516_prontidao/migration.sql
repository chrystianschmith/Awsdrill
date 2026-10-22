-- CreateTable
CREATE TABLE "ReadinessScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examVersionId" TEXT NOT NULL,
    "domainId" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "lowerBound" DOUBLE PRECISION NOT NULL,
    "upperBound" DOUBLE PRECISION NOT NULL,
    "coverage" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "methodologyVersion" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadinessScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReadinessScore_userId_examVersionId_computedAt_idx" ON "ReadinessScore"("userId", "examVersionId", "computedAt");

-- AddForeignKey
ALTER TABLE "ReadinessScore" ADD CONSTRAINT "ReadinessScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessScore" ADD CONSTRAINT "ReadinessScore_examVersionId_fkey" FOREIGN KEY ("examVersionId") REFERENCES "ExamVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessScore" ADD CONSTRAINT "ReadinessScore_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Faixas válidas (estimativa 0–100, cobertura 0–1).
ALTER TABLE "ReadinessScore" ADD CONSTRAINT "ReadinessScore_ranges" CHECK (
  "lowerBound" >= 0 AND "lowerBound" <= "score" AND "score" <= "upperBound" AND "upperBound" <= 100
  AND "coverage" >= 0 AND "coverage" <= 1 AND "sampleSize" >= 0
);
