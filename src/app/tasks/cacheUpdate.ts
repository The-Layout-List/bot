import { cache } from "../../lib/cacheUpdate";
import { config } from "../../lib/config";
import { scheduledTask } from "../../lib/tasks";

export default scheduledTask({
    name: "updateCache",
    schedule: config.scheduleCacheUpdate,
    async execute() {
        await cache.updateLevels();
        await cache.updatePacks();
        await cache.updateUsers();
    }
});
