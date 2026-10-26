const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const {
    setPendingCount,
    resetShiftWeek,
    setCurrentProgress,
    processShiftReminders,
    getActiveStaffIds,
    endShiftWeek
} = require("../../others/shiftSystem.js");
const { Op } = require("sequelize");
const {
    staffGuildId,
    guildId,
    shiftLogsChannelId
} = require("../../config.json");

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("shift-admin")
        .setDescription("Administrative commands for managing the weekly shift")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("setpending")
                .setDescription(
                    "Tell the bot how many records are pending at the start of the week"
                )
                .addIntegerOption((option) =>
                    option
                        .setName("count")
                        .setDescription("Pending record count")
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("resetweek")
                .setDescription(
                    "Reset the weekly shift and assign even workloads"
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("setcount")
                .setDescription(
                    "Manually set the current reviewed count for a staff member"
                )
                .addUserOption((option) =>
                    option
                        .setName("member")
                        .setDescription("Staff member to update")
                        .setRequired(true)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("count")
                        .setDescription("Current reviewed count for the week")
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("force-remind")
                .setDescription("Send shift reminders to all staff members")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("filter-members")
                .setDescription(
                    "Refreshes the list of staff members eligible for shifts"
                )
        ),
    /**
     *
     * @param {import("discord.js").ChatInputCommandInteraction} interaction
     * @returns
     */
    async execute(interaction) {
        const { db } = require("../../index.js");
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "setpending") {
            const count = interaction.options.getInteger("count");
            await setPendingCount(db, count);
            return interaction.editReply({
                content: `Weekly pending count set to ${count}.`
            });
        } else if (subcommand === "resetweek") {
            await endShiftWeek(interaction.client, db);

            const state = await db.shiftState.findOne({ where: { id: 1 } });
            const pending = state?.pendingCount ?? 0;
            const { pendingCount, targetByUser } = await resetShiftWeek(
                db,
                interaction.guild,
                pending
            );

            const shiftlogsChannel = interaction.client.guilds.cache
                .get(staffGuildId ?? guildId)
                .channels.cache.get(shiftLogsChannelId);
            if (shiftlogsChannel) {
                await shiftlogsChannel.send({
                    content: `New shifts just dropped!!\n\n${Object.entries(
                        targetByUser
                    )
                        .map(
                            ([userId, count]) =>
                                `<@${userId}> - **${count} records**`
                        )
                        .join("\n")}`,
                    allowedMentions: {
                        users: Object.entries(targetByUser)
                            .filter(([_, count]) => count > 0)
                            .map(([userId]) => userId)
                    }
                });
            }

            return interaction.editReply({
                content: `Weekly shift reset complete. ${pendingCount} pending records were spread across staff members.`
            });
        } else if (subcommand === "setcount") {
            const member = interaction.options.getUser("member");
            const count = interaction.options.getInteger("count");
            await setCurrentProgress(db, member.id, count);
            return interaction.editReply({
                content: `Current reviewed total for <@${member.id}> has been set to ${count}.`,
                ephemeral: true
            });
        } else if (subcommand === "force-remind") {
            const notifications = await processShiftReminders(
                interaction.client,
                db
            );
            return interaction.editReply({
                content: `Shift reminders sent to ${notifications.length} staff members.`,
                ephemeral: true
            });
        } else if (subcommand === "filter-members") {
            const deletedCount = await db.shiftMembers.destroy({
                where: {
                    discordid: {
                        [Op.notIn]: await getActiveStaffIds(
                            interaction.client.guilds.cache.get(
                                staffGuildId ?? guildId
                            )
                        )
                    }
                }
            });

            return interaction.editReply({
                content: `Staff members eligible for shifts have been refreshed. Removed ${deletedCount} members.`,
                ephemeral: true
            });
        }
    }
};
