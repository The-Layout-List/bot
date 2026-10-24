const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} = require("discord.js");
const { adminRole } = require("../../config.json");
const {
    setPendingCount,
    resetShiftWeek,
    setVacationMode,
    setCurrentProgress,
    getCurrentProgress,
} = require("../../others/shiftSystem.js");

function isAdmin(interaction) {
    return (
        interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
        interaction.member.roles.cache.has(adminRole)
    );
}

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("shift")
        .setDescription("Weekly staff record review tracking")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("progress")
                .setDescription("Check your shift progress"),
        ),
    /**
     *
     * @param {import("discord.js").ChatInputCommandInteraction} interaction
     * @returns
     */
    async execute(interaction) {
        const { db } = require("../../index.js");
        await interaction.deferReply({
            flags: MessageFlags.Ephemeral,
        });

        if (interaction.options.getSubcommand() === "progress") {
            const progress = await getCurrentProgress(db, interaction.user.id);
            return interaction.editReply({
                content: `Shift progress for <@${targetMember.id}>: ${progress.currentCount}/${progress.targetCount} records completed${progress.vacationMode ? " (vacation mode enabled)" : ""}`,
            });
        }
    },
};
