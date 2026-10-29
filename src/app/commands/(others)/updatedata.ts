import { SlashCommandBuilder, MessageFlags } from "discord.js";
import type {
    ChatInputCommand,
    CommandData,
    CommandMetadata
} from "commandkit";
import { cache } from "../../../lib/cacheUpdate";
import { commandGuilds } from "../../../lib/config";

export const command: CommandData = new SlashCommandBuilder()
    .setName("updatedata")
    .setDescription("Updates the cache data from the list")
    .toJSON();

export const metadata: CommandMetadata = { guilds: commandGuilds() };

export const chatInput: ChatInputCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await cache.updateLevels();
    await cache.updatePacks();
    await cache.updateUsers();
    await cache.updateArchived();

    await interaction.editReply(":white_check_mark: Updated data!");
};
