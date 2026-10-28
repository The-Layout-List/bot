import { config } from "../lib/config";
import { db } from "../lib/db";
import { logger } from "../lib/logger";
import type { ScheduledTask } from "./types";

const { guildId } = config;

export default {
    name: "updateLevels",
    cron: "0 0 */6 * * *",
    enabled: true,
    async execute(client) {
        const list = (await db.levelInVoting.findMany()).map(
            (level) => level.discordid
        );

        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;

        for (const channelID of list) {
            if (!channelID) continue;
            const channel = guild.channels.cache.get(channelID);

            if (!channel) {
                // discord channel must not exist anymore, so
                // delete it from the database...
                logger.warn(
                    `Scheduled - Deleting reliable entry with ID ${channelID}`
                );
                await db.levelInVoting.deleteMany({
                    where: {
                        discordid: channelID
                    }
                });
                continue;
            }

            const text = channel.name;
            const matchLevelName = text.match(/^(.*)\s\d+-\d+$/);
            const matchYes = text.match(/(\d+)-\d+$/);
            const matchNo = text.match(/\d+-(\d+)$/);

            if (!matchLevelName || !matchYes || !matchNo) {
                logger.error(
                    `Scheduled - Error processing thread ${text}, skipping...`
                );
                continue;
            }

            await db.levelInVoting.updateMany({
                where: { discordid: channelID },
                data: {
                    levelname: matchLevelName[1],
                    yeses: parseInt(matchYes[1]),
                    nos: parseInt(matchNo[1])
                }
            });
        }
    }
} satisfies ScheduledTask;
