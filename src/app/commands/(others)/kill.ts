import { SlashCommandBuilder } from "discord.js";
import type {
    ChatInputCommand,
    CommandData,
    CommandMetadata
} from "commandkit";
import { commandGuilds } from "../../../lib/config";

export const command: CommandData = new SlashCommandBuilder()
    .setName("exitprocess")
    .setDescription("Stops the bot process (only works if you are sphericle)")
    .toJSON();

export const metadata: CommandMetadata = { guilds: commandGuilds() };

export const chatInput: ChatInputCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    if (interaction.user.id !== "581990926948237322")
        return await interaction.reply("You are not sphericle....");
    interaction.reply(`Stopping...`);
    process.exit();
};
