import { processShiftReminders } from "../lib/shiftSystem";
import type { ScheduledTask } from "./types";

export default {
    name: "sendShiftReminders",
    cron: "0 15 * * *",
    enabled: true,
    async execute(client) {
        await processShiftReminders(client);
    }
} satisfies ScheduledTask;
