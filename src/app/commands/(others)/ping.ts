import { SlashCommandBuilder, MessageFlags } from "discord.js";
import type {
    ChatInputCommand,
    CommandData,
    CommandMetadata
} from "commandkit";
import { commandGuilds } from "../../../lib/config";

export const command: CommandData = new SlashCommandBuilder()
    .setName("botping")
    .setDescription("Bot ping measurements")
    .toJSON();

export const metadata: CommandMetadata = { guilds: commandGuilds() };

export const chatInput: ChatInputCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    const sent = await interaction.reply({
        content: "Pinging...",
        withResponse: true,
        flags: MessageFlags.Ephemeral
    });
    interaction.editReply(
        `Pong! ${
            sent.resource!.message!.createdTimestamp -
            interaction.createdTimestamp
        }ms`
    );
};
