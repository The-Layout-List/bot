import {
    SlashCommandBuilder,
    ActivityType,
    type PresenceStatusData
} from "discord.js";
import type {
    ChatInputCommand,
    CommandData,
    CommandMetadata
} from "commandkit";
import { commandGuilds } from "../../../lib/config";

export const cooldown = 1;

export const command: CommandData = new SlashCommandBuilder()
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
                        { name: "Do Not Disturb", value: "dnd" }
                    )
            )
            .addStringOption((option) =>
                option
                    .setName("activity")
                    .setDescription("The activity to set the bot to")
                    .setRequired(true)
                    .addChoices(
                        { name: "Playing", value: "Playing" },
                        { name: "Streaming", value: "Streaming" },
                        { name: "Listening", value: "Listening" },
                        { name: "Watching", value: "Watching" }
                    )
            )
            .addStringOption((option) =>
                option
                    .setName("text")
                    .setDescription("The text to set the bot's activity to")
                    .setRequired(true)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("reset")
            .setDescription("Reset the bot's status to default")
    )
    .toJSON();

export const metadata: CommandMetadata = { guilds: commandGuilds() };

export const chatInput: ChatInputCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    await interaction.deferReply();
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "set") {
        const status = interaction.options.getString(
            "status",
            true
        ) as PresenceStatusData;
        const activity = interaction.options.getString(
            "activity",
            true
        ) as keyof typeof ActivityType;
        const text = interaction.options.getString("text", true);

        await interaction.client.user.setStatus(status);
        await interaction.client.user.setPresence({
            activities: [
                {
                    name: text,
                    type: ActivityType[activity]
                }
            ],
            status: status
        });
        await interaction.editReply(`:white_check_mark: Bot status updated`);
    } else if (subcommand === "reset") {
        await interaction.client.user.setStatus("online");
        await interaction.client.user.setActivity();
        await interaction.editReply(
            ":white_check_mark: Bot status reset to default"
        );
    }
};
