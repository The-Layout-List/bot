/*
  Warnings:

  - Made the column `discordid` on table `shiftMembers` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "shiftMembers" ALTER COLUMN "discordid" SET NOT NULL;
