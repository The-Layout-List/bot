import { EmbedBuilder, MessageFlags } from "discord.js";
import { config } from "../../lib/config";
import { db } from "../../lib/db";
import { getTextChannel } from "../../lib/discord";
import { logger } from "../../lib/logger";
import { incrementProgress } from "../../lib/shiftSystem";
import type { ModalHandler } from "../types";

const { archiveRecordsID, guildId } = config;

export default {
    customId: "denyBulkRecordsReason",
    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const session = await db.bulkRecordSession.findFirst({
            where: { moderatorID: interaction.user.id }
        });
        if (!session)
            return await interaction.editReply(
                ":x: You're not currently checking bulk records, start a session with /bulkrecord add"
            );

        const records = await db.bulkRecord.findMany({
            where: { moderatorID: interaction.user.id }
        });
        if (records.length === 0)
            return await interaction.editReply(
                ":x: There are no levels in this bulk record to deny"
            );

        const reason = interaction.fields.getTextInputValue("denyReasonInput");

        const guild = await interaction.client.guilds.fetch(guildId);
        const recordsChannel = getTextChannel(guild, archiveRecordsID);

        const denyEmbeds = records.map((record) =>
            new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle(`:x: ${record.levelname}`)
                .addFields(
                    { name: "Record holder", value: session.playerName },
                    { name: "Reason", value: reason }
                )
        );

        for (let i = 0; i < denyEmbeds.length; i += 10) {
            await recordsChannel.send({
                embeds: denyEmbeds.slice(i, i + 10),
                content:
                    i === 0 && session.discordID
                        ? `<@${session.discordID}>`
                        : undefined
            });
        }

        await incrementProgress(interaction.user.id, 1);

        await db.bulkRecordSession.deleteMany({
            where: { moderatorID: interaction.user.id }
        });
        await db.bulkRecord.deleteMany({
            where: { moderatorID: interaction.user.id }
        });

        logger.info(
            `${interaction.user.tag} (${interaction.user.id}) denied ${records.length} bulk records for ${session.playerName} (Reason: '${reason}')`
        );

        return await interaction.editReply(
            `:white_check_mark: Denied ${records.length} record${records.length === 1 ? "" : "s"}!`
        );
    }
} satisfies ModalHandler;
