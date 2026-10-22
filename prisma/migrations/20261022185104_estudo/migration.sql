-- CreateEnum
CREATE TYPE "StudyMode" AS ENUM ('LIVRE', 'POMODORO', 'FOCO');

-- CreateEnum
CREATE TYPE "TopicStatus" AS ENUM ('NAO_INICIADO', 'ESTUDANDO', 'CONCLUIDO', 'REVISAR');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailyGoalMin" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "pomodoroBreakMin" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "pomodoroLongEvery" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "pomodoroLongMin" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "pomodoroWorkMin" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "streakMinMin" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "UserExam" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examVersionId" TEXT NOT NULL,
    "examDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examVersionId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "topicId" TEXT,
    "mode" "StudyMode" NOT NULL DEFAULT 'LIVRE',
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "autoClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPause" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "StudyPause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTopic" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "status" "TopicStatus" NOT NULL DEFAULT 'NAO_INICIADO',
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTopic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserExam_examVersionId_idx" ON "UserExam"("examVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserExam_userId_examVersionId_key" ON "UserExam"("userId", "examVersionId");

-- CreateIndex
CREATE INDEX "StudySession_userId_startedAt_idx" ON "StudySession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "StudySession_examVersionId_idx" ON "StudySession"("examVersionId");

-- CreateIndex
CREATE INDEX "StudySession_domainId_idx" ON "StudySession"("domainId");

-- CreateIndex
CREATE INDEX "StudySession_topicId_idx" ON "StudySession"("topicId");

-- CreateIndex
CREATE INDEX "StudyPause_sessionId_idx" ON "StudyPause"("sessionId");

-- CreateIndex
CREATE INDEX "UserTopic_topicId_idx" ON "UserTopic"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTopic_userId_topicId_key" ON "UserTopic"("userId", "topicId");

-- AddForeignKey
ALTER TABLE "UserExam" ADD CONSTRAINT "UserExam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserExam" ADD CONSTRAINT "UserExam_examVersionId_fkey" FOREIGN KEY ("examVersionId") REFERENCES "ExamVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_examVersionId_fkey" FOREIGN KEY ("examVersionId") REFERENCES "ExamVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPause" ADD CONSTRAINT "StudyPause_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTopic" ADD CONSTRAINT "UserTopic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTopic" ADD CONSTRAINT "UserTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Domain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Regras que o Prisma não expressa no schema:
-- no máximo uma sessão de estudo ativa (sem endedAt) por usuário.
CREATE UNIQUE INDEX "StudySession_one_active_per_user" ON "StudySession"("userId") WHERE "endedAt" IS NULL;
-- sessão encerrada nunca termina antes de começar.
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_end_after_start" CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt");
