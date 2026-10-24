const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const {
    setPendingCount,
    resetShiftWeek,
    setVacationMode,
    setCurrentProgress,
} = require("../../others/shiftSystem.js");

module.exports = {
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
                .setName("vacation")
                .setDescription("Toggle vacation mode for a staff member")
                .addUserOption((option) =>
                    option
                        .setName("member")
                        .setDescription("Staff member to update")
                        .setRequired(true)
                )
                .addBooleanOption((option) =>
                    option
                        .setName("on")
                        .setDescription("Turn vacation mode on or off")
                        .setRequired(true)
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
        switch (subcommand) {
            case "setpending": {
                const count = interaction.options.getInteger("count");
                await setPendingCount(db, count);
                return interaction.editReply({
                    content: `Weekly pending count set to ${count}.`,
                });
            }
            case "resetweek": {
                const state = await db.shiftState.findOne({ where: { id: 1 } });
                const pending = state?.pendingCount ?? 0;
                const { pendingCount } = await resetShiftWeek(
                    db,
                    interaction.guild,
                    pending
                );
                return interaction.editReply({
                    content: `Weekly shift reset complete. ${pendingCount} pending records were spread across staff members.`,
                });
            }
            case "vacation": {
                const member = interaction.options.getUser("member");
                const enabled = interaction.options.getBoolean("on");
                await setVacationMode(db, member.id, enabled);
                return interaction.editReply({
                    content: `Vacation mode for <@${member.id}> is now ${enabled ? "enabled" : "disabled"}.`,
                });
            }
            case "setcount": {
                const member = interaction.options.getUser("member");
                const count = interaction.options.getInteger("count");
                await setCurrentProgress(db, member.id, count);
                return interaction.editReply({
                    content: `Current reviewed total for <@${member.id}> has been set to ${count}.`,
                    ephemeral: true
                });
            }
        }
    }
};
