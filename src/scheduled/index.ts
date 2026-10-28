import type { Client } from "discord.js";
import cron from "node-cron";
import { logger } from "../lib/logger";
import type { ScheduledTask } from "./types";
import cacheUpdate from "./cacheUpdate";
import feedbackSkip from "./feedbackSkip";
import resetShiftWeek from "./resetShiftWeek";
import resetSubmissions from "./resetSubmissions";
import sendShiftReminders from "./sendShiftReminders";
import updateLevels from "./updateLevels";

const tasks: ScheduledTask[] = [
    cacheUpdate,
    feedbackSkip,
    resetShiftWeek,
    resetSubmissions,
    sendShiftReminders,
    updateLevels
];

let initialized = false;

// Scheduled cron tasks
export function scheduledTasksInit(client: Client<true>): void {
    if (initialized) return;
    initialized = true;

    logger.info("Setting up scheduled tasks");
    for (const task of tasks) {
        if (task.enabled) {
            cron.schedule(task.cron, async () => {
                try {
                    await task.execute(client);
                } catch (error) {
                    logger.error(
                        `Scheduled - Error running ${task.name}:`,
                        error
                    );
                }
            });
            logger.info(`  Started ${task.name}(${task.cron})`);
        } else {
            logger.info(`  Ignored disabled ${task.name}(${task.cron})`);
        }
    }
    logger.info("Scheduled tasks setup done");
}
