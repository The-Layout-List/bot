import { SlashCommandBuilder, MessageFlags } from "discord.js";
import type {
    ChatInputCommand,
    CommandData,
    CommandMetadata
} from "commandkit";
import {
    formatElo,
    getCurrentProgress,
    getElo
} from "../../../lib/shiftSystem";
import { config, commandGuilds } from "../../../lib/config";

const { vacationModeRoleId } = config;

export const command: CommandData = new SlashCommandBuilder()
    .setName("shift")
    .setDescription("Weekly staff record review tracking")
    .addSubcommand((subcommand) =>
        subcommand
            .setName("progress")
            .setDescription("Check your shift progress")
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("elo")
            .setDescription("Check your current shift elo and total elo")
    )
    .toJSON();

export const metadata: CommandMetadata = { guilds: commandGuilds() };

export const chatInput: ChatInputCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    await interaction.deferReply({
        flags: MessageFlags.Ephemeral
    });

    if (interaction.options.getSubcommand() === "progress") {
        const progress = await getCurrentProgress(interaction.user.id);
        return interaction.editReply({
            content: `Shift progress for <@${interaction.user.id}>: ${progress.currentCount}/${progress.targetCount} records completed${interaction.member.roles.cache.has(vacationModeRoleId) ? " (vacation mode enabled)" : ""}`
        });
    } else if (interaction.options.getSubcommand() === "elo") {
        const { elo, totalElo } = await getElo(interaction.user.id);
        return interaction.editReply({
            content: `Shift elo for <@${interaction.user.id}>:\nElo: **${formatElo(elo)}**\nTotal elo: **${formatElo(totalElo)}**`
        });
    }
};
