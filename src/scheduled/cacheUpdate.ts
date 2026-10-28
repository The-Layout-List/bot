import { cache } from "../lib/cacheUpdate";
import { config } from "../lib/config";
import type { ScheduledTask } from "./types";

export default {
    name: "updateCache",
    cron: config.scheduleCacheUpdate,
    enabled: true,
    async execute() {
        await cache.updateLevels();
        await cache.updatePacks();
        await cache.updateUsers();
    }
} satisfies ScheduledTask;
