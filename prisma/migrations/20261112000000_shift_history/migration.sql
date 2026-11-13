-- CreateTable
CREATE TABLE "shiftHistory" (
    "id" SERIAL NOT NULL,
    "discordid" TEXT NOT NULL,
    "completedCount" INTEGER NOT NULL,
    "targetCount" INTEGER NOT NULL,
    "weekStartedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shiftHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shiftHistory_discordid_endedAt_idx" ON "shiftHistory"("discordid", "endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "shiftHistory_discordid_weekStartedAt_key" ON "shiftHistory"("discordid", "weekStartedAt");

