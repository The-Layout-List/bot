ALTER TABLE "shiftMembers" ALTER COLUMN "elo" SET DEFAULT 25;
ALTER TABLE "shiftMembers" ALTER COLUMN "totalElo" SET DEFAULT 25;
UPDATE "shiftMembers" SET "elo" = 25;
UPDATE "shiftMembers" SET "totalElo" = 25;