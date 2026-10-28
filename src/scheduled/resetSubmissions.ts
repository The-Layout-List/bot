import { db } from "../lib/db";
import { logger } from "../lib/logger";
import type { ScheduledTask } from "./types";

export default {
    name: "resetSubmissions",
    cron: "0 4 1 * *",
    enabled: true,
    async execute() {
        logger.log("Scheduled - Resetting submissions for all users...");
        await db.submitter.updateMany({ data: { submissions: 0 } });
        await db.levelStats.updateMany({
            data: { submissions: 0, accepts: 0, denies: 0 }
        });
        logger.log("Scheduled - Submissions reset!");
    }
} satisfies ScheduledTask;
