const {
    SlashCommandBuilder,
    PermissionFlagsBits,
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
                .setName("setpending")
                .setDescription("Tell the bot how many records are pending at the start of the week")
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
                .setDescription("Reset the weekly shift and assign even workloads")
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
                .setName("setcurrent")
                .setDescription("Manually set the current reviewed count for a staff member")
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
                .setName("progress")
                .setDescription("Check your shift progress")
                .addUserOption((option) =>
                    option
                        .setName("member")
                        .setDescription("Staff member to inspect (optional)")
                )
        ),
    async execute(interaction) {
        const { db } = require("../../index.js");

        if (interaction.options.getSubcommand() === "progress") {
            const targetMember =
                interaction.options.getUser("member") ?? interaction.user;
            const isSelf = targetMember.id === interaction.user.id;
            if (!isSelf && !isAdmin(interaction)) {
                return interaction.reply({
                    content: "Only admins can inspect other members' shift progress.",
                    ephemeral: true,
                });
            }
            const progress = await getCurrentProgress(db, targetMember.id);
            return interaction.reply({
                content: `Shift progress for <@${targetMember.id}>: ${progress.currentCount}/${progress.targetCount} records completed${progress.vacationMode ? " (vacation mode enabled)" : ""}`,
                ephemeral: true,
            });
        }

        if (!isAdmin(interaction)) {
            return interaction.reply({
                content: "This command is restricted to staff admins.",
                ephemeral: true,
            });
        }

        switch (interaction.options.getSubcommand()) {
            case "setpending": {
                const count = interaction.options.getInteger("count");
                await setPendingCount(db, count);
                return interaction.reply({
                    content: `Weekly pending count set to ${count}.`,
                    ephemeral: true,
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
                return interaction.reply({
                    content: `Weekly shift reset complete. ${pendingCount} pending records were spread across the active staff members.`,
                    ephemeral: true,
                });
            }
            case "vacation": {
                const member = interaction.options.getUser("member");
                const enabled = interaction.options.getBoolean("on");
                await setVacationMode(db, member.id, enabled);
                return interaction.reply({
                    content: `Vacation mode for <@${member.id}> is now ${enabled ? "enabled" : "disabled"}.`,
                    ephemeral: true,
                });
            }
            case "setcurrent": {
                const member = interaction.options.getUser("member");
                const count = interaction.options.getInteger("count");
                await setCurrentProgress(db, member.id, count);
                return interaction.reply({
                    content: `Current reviewed total for <@${member.id}> has been set to ${count}.`,
                    ephemeral: true,
                });
            }
            default:
                return interaction.reply({
                    content: "Unknown shift command.",
                    ephemeral: true,
                });
        }
    },
};
