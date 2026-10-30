-- AlterTable
ALTER TABLE "pendingRecords" DROP COLUMN "fps";

-- AlterTable
ALTER TABLE "acceptedRecords" DROP COLUMN "fps";

-- AlterTable
ALTER TABLE "deniedRecords" DROP COLUMN "fps";

-- AlterTable
ALTER TABLE "bulkRecordSessions" DROP COLUMN "fps";
