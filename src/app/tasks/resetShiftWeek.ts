import { config } from "../../lib/config";
import { db } from "../../lib/db";
import { endShiftWeek, resetShiftWeek } from "../../lib/shiftSystem";
import { scheduledTask } from "../../lib/tasks";

const { shiftLogsChannelId, staffGuildId, guildId } = config;

export default scheduledTask({
    name: "resetShiftWeek",
    schedule: "0 0 * * 1",
    async execute(client) {
        const guild = client.guilds.cache.get(staffGuildId ?? guildId);
        if (!guild) return;

        await endShiftWeek(client);

        const state = await db.shiftState.findUnique({ where: { id: 1 } });
        const pending = state?.pendingCount ?? 0;
        const { targetByUser } = await resetShiftWeek(guild, pending);

        const shiftlogsChannel = guild.channels.cache.get(shiftLogsChannelId);
        if (shiftlogsChannel && shiftlogsChannel.isSendable()) {
            await shiftlogsChannel.send({
                content: `New shifts just dropped!!\n\n${Object.entries(
                    targetByUser
                )
                    .map(
                        ([userId, count]) =>
                            `<@${userId}> - **${count} records**`
                    )
                    .join(
                        "\n"
                    )}\n\nDue <t:${Math.floor((Date.now() + 7 * 24 * 60 * 60 * 1000) / 1000)}:f>`,
                allowedMentions: {
                    users: Object.entries(targetByUser)
                        .filter(([, count]) => count > 0)
                        .map(([userId]) => userId)
                }
            });
        }
    }
});
