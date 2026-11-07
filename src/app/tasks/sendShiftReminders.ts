import { Logger } from "commandkit";
import { processShiftReminders } from "../../lib/shiftSystem";
import { scheduledTask } from "../../lib/tasks";

export default scheduledTask({
    name: "sendShiftReminders",
    schedule: "0 15 * * *",
    async execute(client) {
        const notifs = await processShiftReminders(client);
        Logger.log(`Sent ${notifs.length} shift reminders.`)
        return;
    }
});
