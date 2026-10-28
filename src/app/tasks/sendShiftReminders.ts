import { processShiftReminders } from "../../lib/shiftSystem";
import { scheduledTask } from "../../lib/tasks";

export default scheduledTask({
    name: "sendShiftReminders",
    schedule: "0 15 * * *",
    async execute(client) {
        await processShiftReminders(client);
    }
});
