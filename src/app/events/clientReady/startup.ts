import { ActivityType, type Client } from "discord.js";
import { cache } from "../../../lib/cacheUpdate";
import { octokit } from "../../../lib/github";
import { logger } from "../../../lib/logger";
import { removeErroredRecords } from "../../../lib/records";
import {
    checkGithubPermissions,
    ensureDatabaseDefaults
} from "../../../lib/utils";
import { scheduledTasksInit } from "../../../scheduled";

export const once = true;

export default async function (client: Client<true>) {
    logger.info(`Client logged in as ${client.user.username}`);

    try {
        await ensureDatabaseDefaults();
    } catch (error) {
        logger.error("Unable to sync database data: \n", error);
        process.exit(1);
    }

    await checkGithubPermissions(octokit);

    try {
        client.user.setPresence({
            activities: [
                {
                    name: "layouts",
                    type: ActivityType.Playing
                }
            ],
            status: "online"
        });
    } catch (e) {
        logger.error(`Error setting presence: ${e}`);
    }

    // Update levels cache
    await cache.updateLevels();
    // Update users cache
    const usersResult = await cache.updateUsers();
    if (typeof usersResult === "string") logger.error(usersResult);
    // Update packs cache
    await cache.updatePacks();

    logger.info("Checking pending record data...");

    const nbFound = await removeErroredRecords(client);
    logger.info(`Found a total of ${nbFound} errored records.`);

    scheduledTasksInit(client);
    logger.info(`Initialization complete`);
}
