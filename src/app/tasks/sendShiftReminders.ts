import { processShiftReminders } from "../../lib/shiftSystem";
import { scheduledTask } from "../../lib/tasks";
import logger from "../../lib/logger";

export default scheduledTask({
    name: "sendShiftReminders",
    schedule: "0 15 * * *",
    async execute(client) {
        const notifs = await processShiftReminders(client);
        logger.log(`Sent ${notifs.length} shift reminders.`)
        return;
    }
});
