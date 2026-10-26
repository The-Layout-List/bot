const { endShiftWeek } = require("../others/shiftSystem.js");
const { resetShiftWeek } = require("../others/shiftSystem.js");
const { shiftLogsChannelId, staffGuildId, guildId } = require("../config.json");

module.exports = {
    name: "resetShiftWeek",
    cron: "0 0 * * 1",
    enabled: true,
    async execute() {
        const { client, db } = require("../index.js");
        if (!client || !db) return;

        await endShiftWeek(client, db);

        const state = await db.shiftState.findOne({ where: { id: 1 } });
        const pending = state?.pendingCount ?? 0;
        const { targetByUser } = await resetShiftWeek(
            db,
            client.guilds.cache.get(staffGuildId ?? guildId),
            pending
        );

        const shiftlogsChannel = client.guilds.cache
            .get(staffGuildId ?? guildId)
            .channels.cache.get(shiftLogsChannelId);
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
                        .filter(([_, count]) => count > 0)
                        .map(([userId]) => userId)
                }
            });
        }
    }
};
