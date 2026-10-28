import { db } from "../../lib/db";
import { logger } from "../../lib/logger";
import { scheduledTask } from "../../lib/tasks";

export default scheduledTask({
    name: "resetSubmissions",
    schedule: "0 4 1 * *",
    async execute() {
        logger.log("Scheduled - Resetting submissions for all users...");
        await db.submitter.updateMany({ data: { submissions: 0 } });
        await db.levelStats.updateMany({
            data: { submissions: 0, accepts: 0, denies: 0 }
        });
        logger.log("Scheduled - Submissions reset!");
    }
});
