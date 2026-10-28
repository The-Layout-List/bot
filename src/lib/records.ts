import type { Client } from "discord.js";
import { config } from "./config";
import { db } from "./db";
import { logger } from "./logger";

const {
    guildId,
    enableSeparateStaffServer,
    staffGuildId,
    pendingRecordsID,
    priorityRecordsID,
    enablePriorityRole
} = config;

/**
 * Removes pending records whose message no longer exists in the pending
 * channel. Returns the number of records removed.
 */
export async function removeErroredRecords(client: Client): Promise<number> {
    const pendingRecords = await db.pendingRecord.findMany();
    let nbFound = 0;
    const guild = await client.guilds.fetch(
        enableSeparateStaffServer ? staffGuildId : guildId
    );
    const pendingChannel = guild.channels.cache.get(pendingRecordsID);
    const priorityChannel = enablePriorityRole
        ? guild.channels.cache.get(priorityRecordsID)
        : pendingChannel;
    for (const record of pendingRecords) {
        const channel =
            enablePriorityRole && record.priority
                ? priorityChannel
                : pendingChannel;
        if (!channel?.isTextBased()) continue;
        try {
            await channel.messages.fetch(record.discordid ?? "");
        } catch {
            await db.pendingRecord.delete({ where: { id: record.id } });
            nbFound++;
            logger.info(`Found an errored record : ${record.discordid}`);

            // Try deleting the other message as well in case only the first one is missing smh
            try {
                await (
                    await channel.messages.fetch(record.embedDiscordid ?? "")
                ).delete();
            } catch {
                // Nothing to do
            }
        }
    }
    return nbFound;
}
