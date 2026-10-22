-- AlterEnum
ALTER TYPE "StudyMode" ADD VALUE 'CICLO';

-- CreateTable
CREATE TABLE "StudyCycle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examVersionId" TEXT NOT NULL,
    "totalMin" INTEGER NOT NULL,
    "number" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "StudyCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyCycleDomain" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "targetMin" INTEGER NOT NULL,
    "doneMin" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StudyCycleDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "doneAt" TIMESTAMP(3),
    "goodResult" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyCycle_userId_closedAt_idx" ON "StudyCycle"("userId", "closedAt");

-- CreateIndex
CREATE INDEX "StudyCycle_examVersionId_idx" ON "StudyCycle"("examVersionId");

-- CreateIndex
CREATE INDEX "StudyCycleDomain_domainId_idx" ON "StudyCycleDomain"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyCycleDomain_cycleId_domainId_key" ON "StudyCycleDomain"("cycleId", "domainId");

-- CreateIndex
CREATE INDEX "Review_userId_doneAt_dueAt_idx" ON "Review"("userId", "doneAt", "dueAt");

-- CreateIndex
CREATE INDEX "Review_topicId_idx" ON "Review"("topicId");

-- AddForeignKey
ALTER TABLE "StudyCycle" ADD CONSTRAINT "StudyCycle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyCycle" ADD CONSTRAINT "StudyCycle_examVersionId_fkey" FOREIGN KEY ("examVersionId") REFERENCES "ExamVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyCycleDomain" ADD CONSTRAINT "StudyCycleDomain_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "StudyCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyCycleDomain" ADD CONSTRAINT "StudyCycleDomain_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Domain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Um ciclo aberto por usuário e uma revisão pendente por tarefa.
CREATE UNIQUE INDEX "StudyCycle_one_open_per_user" ON "StudyCycle"("userId") WHERE "closedAt" IS NULL;
CREATE UNIQUE INDEX "Review_one_pending_per_topic" ON "Review"("userId", "topicId") WHERE "doneAt" IS NULL;
ALTER TABLE "StudyCycle" ADD CONSTRAINT "StudyCycle_totalMin_positive" CHECK ("totalMin" > 0);
