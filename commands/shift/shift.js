const {
    SlashCommandBuilder,
    MessageFlags
} = require("discord.js");
const { getCurrentProgress } = require("../../others/shiftSystem.js");

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("shift")
        .setDescription("Weekly staff record review tracking")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("progress")
                .setDescription("Check your shift progress")
        ),
    /**
     *
     * @param {import("discord.js").ChatInputCommandInteraction} interaction
     * @returns
     */
    async execute(interaction) {
        const { db } = require("../../index.js");
        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        if (interaction.options.getSubcommand() === "progress") {
            const progress = await getCurrentProgress(db, interaction.user.id);
            return interaction.editReply({
                content: `Shift progress for <@${targetMember.id}>: ${progress.currentCount}/${progress.targetCount} records completed${progress.vacationMode ? " (vacation mode enabled)" : ""}`
            });
        }
    }
};
