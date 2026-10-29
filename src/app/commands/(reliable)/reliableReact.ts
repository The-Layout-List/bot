import { ContextMenuCommandBuilder, ApplicationCommandType } from "discord.js";
import type {
    MessageContextMenuCommand,
    CommandData,
    CommandMetadata
} from "commandkit";
import { commandGuilds } from "../../../lib/config";
// bro why are context menus of type app command

export const command: CommandData = new ContextMenuCommandBuilder()
    .setName("Reliable Poll React")
    .setType(ApplicationCommandType.Message)
    .toJSON();

export const metadata: CommandMetadata = { guilds: commandGuilds() };

export const messageContextMenu: MessageContextMenuCommand = async ({
    interaction
}) => {
    const message = await interaction.channel!.messages.fetch(
        interaction.targetId
    );

    await message.react("⬆️");
    await message.react("👍");
    await message.react("⬇️");

    return interaction.editReply("✅");
};
