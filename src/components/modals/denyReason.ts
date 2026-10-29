import { findTextChannel, getTextChannel } from "../../lib/discord";
import { EmbedBuilder, MessageFlags } from "discord.js";
import { config } from "../../lib/config";
import { db, incrementDailyStat } from "../../lib/db";
import { logger } from "../../lib/logger";
import type { ModalHandler } from "../types";

const {
    archiveRecordsID,
    deniedRecordsID,
    recordsID,
    guildId,
    staffGuildId,
    enableSeparateStaffServer
} = config;

export default {
    customId: "denyReason",
    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        // Check for record info corresponding to the message id
        if (!interaction.message)
            return await interaction.editReply(":x: This form has expired");
        const record = await db.pendingRecord.findFirst({
            where: { discordid: interaction.message.id }
        });
        if (!record) {
            await interaction.editReply(
                ":x: Couldn't find a record linked to that discord message ID"
            );
            try {
                await interaction.message.delete();
            } catch (error) {
                logger.info(error);
            }
            return;
        }

        // Get reason from the text field
        const reason = interaction.fields.getTextInputValue("denyReasonInput");

        // Add record to denied table
        try {
            await db.deniedRecord.create({
                data: {
                    username: record.username,
                    submitter: record.submitter,
                    levelname: record.levelname,
                    device: record.device,
                    completionlink: record.completionlink,
                    raw: record.raw,
                    ldm: record.ldm,
                    modMenu: record.modMenu,
                    additionalnotes: record.additionalnotes,
                    priority: record.priority,
                    denyReason: reason,
                    moderator: interaction.user.id
                }
            });
        } catch (error) {
            logger.info(
                `Couldn't add the denied record ; something went wrong with Prisma : ${error}`
            );
            return await interaction.editReply(
                ":x: Something went wrong while adding the denied record to the database"
            );
        }

        // Create embed with all record info to send in archive
        const denyArchiveEmbed = new EmbedBuilder()
            .setColor(0xcc0000)
            .setTitle(`:x: ${record.levelname}`)
            .addFields(
                {
                    name: "Record submitted by",
                    value: `<@${record.submitter}>`,
                    inline: true
                },
                {
                    name: "Record holder",
                    value: `${record.username}`,
                    inline: true
                },
                {
                    name: "Record denied by",
                    value: `<@${interaction.user.id}>`
                },
                { name: "Deny Reason", value: `${reason}` },
                { name: "Device", value: `${record.device}`, inline: true },
                {
                    name: "LDM",
                    value: `${record.ldm == 0 ? "None" : record.ldm}`,
                    inline: true
                },
                { name: "Completion link", value: `${record.completionlink}` },
                { name: "Raw link", value: `${record.raw}` },
                { name: "Mod menu", value: `${record.modMenu}` },
                { name: "Additional Info", value: `${record.additionalnotes}` }
            )
            .setTimestamp();

        // Create embed to send in denied-record-log
        const denyEmbed = new EmbedBuilder()
            .setColor(0xcc0000)
            .setTitle(`:x: ${record.levelname}`)
            .addFields(
                {
                    name: "Record submitted by",
                    value: `<@${record.submitter}>`,
                    inline: true
                },
                {
                    name: "Record holder",
                    value: `${record.username}`,
                    inline: true
                },
                {
                    name: "Record denied by",
                    value: `<@${interaction.user.id}>`
                },
                { name: "Deny Reason", value: `${reason}` },
                { name: "Device", value: `${record.device}`, inline: true },
                {
                    name: "LDM",
                    value: `${record.ldm == 0 ? "None" : record.ldm}`,
                    inline: true
                },
                { name: "Completion link", value: `${record.completionlink}` }
            )
            .setTimestamp();

        // Create embed to send in public channel
        const publicDenyEmbed = new EmbedBuilder()
            .setColor(0xcc0000)
            .setTitle(`:x: ${record.levelname}`)
            .setDescription(
                "Denied\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800"
            )
            .addFields(
                { name: "Record holder", value: `${record.username}` },
                { name: "Deny Reason", value: `${reason}` }
            );

        const guild = await interaction.client.guilds.fetch(guildId);
        const staffGuild = enableSeparateStaffServer
            ? await interaction.client.guilds.fetch(staffGuildId)
            : guild;
        // Send all messages (notify the submitter that the record was denied, expect for group submissions and duplicates)
        await getTextChannel(staffGuild, archiveRecordsID).send({
            embeds: [denyArchiveEmbed]
        });
        await findTextChannel(staffGuild, deniedRecordsID)?.send({
            embeds: [denyEmbed]
        });
        await getTextChannel(guild, recordsID).send({
            content: `<@${record.submitter}>`,
            embeds: [publicDenyEmbed]
        });

        // Remove message from pending
        try {
            await interaction.message.delete();
            if (record.embedDiscordid != null)
                await (
                    await interaction.message.channel.messages.fetch(
                        record.embedDiscordid
                    )
                ).delete();
        } catch (_) {
            await interaction.editReply(
                ":x: The record has already been accepted/denied"
            );
            return;
        }

        // Remove record from pending table
        await db.pendingRecord.deleteMany({
            where: { id: record.id }
        });

        // Update moderator data
        const modInfo = await db.staff.findFirst({
            where: { moderator: interaction.user.id }
        });
        if (!modInfo) {
            await db.staff.create({
                data: {
                    moderator: interaction.user.id,
                    nbRecords: 1,
                    nbDenied: 1,
                    nbAccepted: 0
                }
            });
        } else {
            await db.staff.update({
                where: { id: modInfo.id },
                data: { nbRecords: { increment: 1 } }
            });
            await db.staff.update({
                where: { id: modInfo.id },
                data: { nbDenied: { increment: 1 } }
            });
        }

        await incrementDailyStat("nbRecordsDenied");

        // Reply
        logger.info(
            `${interaction.user.tag} (${interaction.user.id}) denied ${record.levelname} for ${record.username} submitted by ${record.submitter} (Reason: '${reason}')`
        );
        return await interaction.editReply(
            ":white_check_mark: The record has been denied"
        );
    }
} satisfies ModalHandler;
