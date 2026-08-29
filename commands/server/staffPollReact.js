// bro why are context menus of type app command

const {
    ContextMenuCommandBuilder,
    ApplicationCommandType,
} = require("discord.js");

module.exports = {
    enabled: true,
    data: new ContextMenuCommandBuilder()
        .setName("Staff Poll React")
        .setType(ApplicationCommandType.Message),
    async execute(interaction) {
        const message = await interaction.channel.messages.fetch(
            interaction.targetId
        );

        await message.react("✅");
        await message.react("❌");

        return interaction.editReply("✅");
    },
};
