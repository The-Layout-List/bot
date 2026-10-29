import { SlashCommandBuilder } from "discord.js";
import type {
    ChatInputCommand,
    CommandData,
    CommandMetadata
} from "commandkit";
import { commandGuilds } from "../../../lib/config";

export const command: CommandData = new SlashCommandBuilder()
    .setName("checklevel")
    .setDescription(
        "Command to check whether a GD level has been delisted automatically"
    )
    .addStringOption((option) =>
        option
            .setName("id")
            .setDescription("The level ID to check")
            .setRequired(true)
    )
    .toJSON();

export const metadata: CommandMetadata = { guilds: commandGuilds() };

export const chatInput: ChatInputCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    const lvlId = interaction.options.getString("id", true);
    const url = `https://gdbrowser.com/api/level/${lvlId}`;

    const req = await fetch(url);
    if (req.ok) {
        await interaction.reply(`Found it!\nhttps://gdbrowser.com/${lvlId}`);
        return;
    } else {
        await interaction.reply(
            `Not found... try **removing any "art" in the level, or other areas with many objects in one place.** The GD servers automatically detect levels with images added using mods, but they're not very good at it! Blame robtop!`
        );
        return;
    }
};
