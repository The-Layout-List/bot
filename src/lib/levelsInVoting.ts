import type { Client } from "discord.js";
import { config } from "./config";
import { db } from "./db";
import { logger } from "./logger";

const { guildId } = config;

/** Syncs the levels in voting with their threads' names (name and vote) */
export async function syncLevelsInVoting(client: Client<true>): Promise<void> {
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
