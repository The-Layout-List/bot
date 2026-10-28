-- CreateTable
CREATE TABLE "pendingRecords" (
    "id" SERIAL NOT NULL,
    "username" TEXT,
    "submitter" TEXT,
    "levelname" TEXT,
    "device" TEXT,
    "completionlink" TEXT,
    "enjoyment" INTEGER,
    "fps" INTEGER,
    "percent" INTEGER,
    "raw" TEXT,
    "ldm" INTEGER,
    "additionalnotes" TEXT,
    "discordid" TEXT,
    "embedDiscordid" TEXT,
    "priority" BOOLEAN,
    "assigned" TEXT,
    "modMenu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pendingRecords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acceptedRecords" (
    "id" SERIAL NOT NULL,
    "username" TEXT,
    "submitter" TEXT,
    "levelname" TEXT,
    "device" TEXT,
    "completionlink" TEXT,
    "enjoyment" INTEGER,
    "fps" INTEGER,
    "percent" INTEGER,
    "raw" TEXT,
    "ldm" INTEGER,
    "additionalnotes" TEXT,
    "priority" BOOLEAN,
    "modMenu" TEXT,
    "moderator" TEXT,
    "filename" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acceptedRecords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deniedRecords" (
    "id" SERIAL NOT NULL,
    "username" TEXT,
    "submitter" TEXT,
    "levelname" TEXT,
    "device" TEXT,
    "completionlink" TEXT,
    "enjoyment" INTEGER,
    "fps" INTEGER,
    "percent" INTEGER,
    "raw" TEXT,
    "ldm" INTEGER,
    "additionalnotes" TEXT,
    "discordid" TEXT,
    "priority" BOOLEAN,
    "modMenu" TEXT,
    "denyReason" TEXT,
    "moderator" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deniedRecords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recordsToCommit" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "githubCode" TEXT NOT NULL,
    "discordid" TEXT NOT NULL,
    "user" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recordsToCommit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulkRecordSessions" (
    "id" SERIAL NOT NULL,
    "moderatorID" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "video" TEXT NOT NULL,
    "mobile" BOOLEAN NOT NULL,
    "fps" INTEGER NOT NULL,
    "note" TEXT,
    "discordID" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulkRecordSessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulkRecords" (
    "id" SERIAL NOT NULL,
    "moderatorID" TEXT NOT NULL,
    "enjoyment" INTEGER,
    "percent" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "levelname" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulkRecords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levelsToPlace" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "githubCode" TEXT NOT NULL,
    "discordid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "levelsToPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levelsToMove" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "discordid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "levelsToMove_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levelsToLegacy" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "discordid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "levelsToLegacy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levelsFromLegacy" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "discordid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "levelsFromLegacy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "changelogs" (
    "id" SERIAL NOT NULL,
    "levelname" TEXT,
    "old_position" INTEGER,
    "new_position" INTEGER,
    "level_above" TEXT,
    "level_below" TEXT,
    "action" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "changelogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levelsInVoting" (
    "id" SERIAL NOT NULL,
    "levelname" TEXT,
    "submitter" TEXT,
    "discordid" TEXT,
    "yeses" INTEGER,
    "nos" INTEGER,
    "shared" TEXT,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "levelsInVoting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messageLocks" (
    "id" SERIAL NOT NULL,
    "discordid" TEXT,
    "locked" BOOLEAN,
    "userdiscordid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messageLocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" SERIAL NOT NULL,
    "moderator" TEXT,
    "nbRecords" INTEGER,
    "nbAccepted" INTEGER,
    "nbDenied" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shiftMembers" (
    "id" SERIAL NOT NULL,
    "discordid" TEXT,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "targetCount" INTEGER NOT NULL DEFAULT 0,
    "reminder5Sent" BOOLEAN NOT NULL DEFAULT false,
    "reminder6Sent" BOOLEAN NOT NULL DEFAULT false,
    "weekStartedAt" TIMESTAMP(3),
    "lastUpdated" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shiftMembers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shiftState" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "pendingCount" INTEGER NOT NULL DEFAULT 0,
    "weekStartedAt" TIMESTAMP(3),
    "reminder5Sent" BOOLEAN NOT NULL DEFAULT false,
    "reminder6Sent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shiftState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levelStats" (
    "id" SERIAL NOT NULL,
    "submissions" INTEGER NOT NULL DEFAULT 0,
    "accepts" INTEGER NOT NULL DEFAULT 0,
    "denies" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "levelStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dailyStats" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "nbRecordsSubmitted" INTEGER NOT NULL DEFAULT 0,
    "nbRecordsPending" INTEGER NOT NULL DEFAULT 0,
    "nbRecordsAccepted" INTEGER NOT NULL DEFAULT 0,
    "nbRecordsDenied" INTEGER NOT NULL DEFAULT 0,
    "nbMembersJoined" INTEGER NOT NULL DEFAULT 0,
    "nbMembersLeft" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dailyStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" SERIAL NOT NULL,
    "moderator" TEXT,
    "sendAcceptedInDM" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "infos" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "infos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embeds" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "guild" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "discordid" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "color" TEXT,
    "image" TEXT,
    "sent" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "embeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "guild" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "discordid" TEXT NOT NULL,
    "content" TEXT,
    "sent" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submitters" (
    "id" SERIAL NOT NULL,
    "discordid" TEXT,
    "submissions" INTEGER,
    "dmFlag" BOOLEAN,
    "banned" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submitters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skippers" (
    "id" SERIAL NOT NULL,
    "user" TEXT,
    "count" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skippers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nextGif" (
    "id" SERIAL NOT NULL,
    "value" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nextGif_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedbackMsgs" (
    "id" SERIAL NOT NULL,
    "feedbackId" TEXT,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedbackMsgs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cache_levels" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cache_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cache_archived" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER,
    "filename" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cache_archived_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cache_legacy_levels" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cache_legacy_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cache_users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "user_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cache_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cache_packs" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "difficulty" INTEGER,
    "isDiff" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cache_packs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pendingRecords_discordid_key" ON "pendingRecords"("discordid");

-- CreateIndex
CREATE INDEX "acceptedRecords_moderator_idx" ON "acceptedRecords"("moderator");

-- CreateIndex
CREATE INDEX "acceptedRecords_createdAt_idx" ON "acceptedRecords"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "deniedRecords_discordid_key" ON "deniedRecords"("discordid");

-- CreateIndex
CREATE INDEX "deniedRecords_moderator_idx" ON "deniedRecords"("moderator");

-- CreateIndex
CREATE INDEX "deniedRecords_createdAt_idx" ON "deniedRecords"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "shiftMembers_discordid_key" ON "shiftMembers"("discordid");

-- CreateIndex
CREATE UNIQUE INDEX "dailyStats_date_key" ON "dailyStats"("date");

-- CreateIndex
CREATE UNIQUE INDEX "infos_name_key" ON "infos"("name");

-- CreateIndex
CREATE UNIQUE INDEX "submitters_discordid_key" ON "submitters"("discordid");

-- CreateIndex
CREATE UNIQUE INDEX "skippers_user_key" ON "skippers"("user");

-- CreateIndex
CREATE UNIQUE INDEX "nextGif_value_key" ON "nextGif"("value");

-- CreateIndex
CREATE UNIQUE INDEX "feedbackMsgs_feedbackId_key" ON "feedbackMsgs"("feedbackId");
