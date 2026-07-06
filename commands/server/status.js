const {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
} = require("discord.js");
const logger = require("log4js").getLogger();
module.exports = {
    enabled: true,
    cooldown: 1,
    data: new SlashCommandBuilder()
        .setName("status")
        .setDescription("Control the bot's status")
        .setDefaultMemberPermissions(0)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("set")
                .setDescription("Set the bot's status")
                .addStringOption((option) =>
                    option
                        .setName("status")
                        .setDescription("The status to set the bot to")
                        .setRequired(true)
                        .addChoices(
                            { name: "Online", value: "online" },
                            { name: "Idle", value: "idle" },
                            { name: "Do Not Disturb", value: "dnd" },
                        ),
                )
                .addStringOption((option) =>
                    option
                        .setName("activity")
                        .setDescription("The activity to set the bot to")
                        .setRequired(true)
                        .addChoices(
                            { name: "Playing", value: "PLAYING" },
                            { name: "Streaming", value: "STREAMING" },
                            { name: "Listening", value: "LISTENING" },
                            { name: "Watching", value: "WATCHING" },
                        ),
                )
                .addStringOption((option) =>
                    option
                        .setName("text")
                        .setDescription("The text to set the bot's activity to")
                        .setRequired(true),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("reset")
                .setDescription("Reset the bot's status to default"),
        ),

    /**
     *
     * @param {ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "set") {
            const status = interaction.options.getString("status");
            const activity = interaction.options.getString("activity");
            const text = interaction.options.getString("text");

            await interaction.client.user.setStatus(status);
            await interaction.client.user.setActivity(text, { type: activity });
            await interaction.editReply(
                `:white_check_mark: Bot status updated`,
            );
        } else if (subcommand === "reset") {
            await interaction.client.user.setStatus("online");
            await interaction.client.user.setActivity();
            await interaction.editReply(
                ":white_check_mark: Bot status reset to default",
            );
        }
    },
};
