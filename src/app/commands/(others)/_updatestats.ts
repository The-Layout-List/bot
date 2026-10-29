import { SlashCommandBuilder, MessageFlags } from "discord.js";
import type {
    ChatInputCommand,
    CommandData,
    CommandMetadata
} from "commandkit";
import { db } from "../../../lib/db";
import { countRecordsPerDay } from "../../../lib/stats";
import { commandGuilds } from "../../../lib/config";

export const command: CommandData = new SlashCommandBuilder()
    .setName("updatestats")
    .setDescription("Update the daily stats from the records database")
    .toJSON();

export const metadata: CommandMetadata = { guilds: commandGuilds() };

export const chatInput: ChatInputCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const acceptedData = await countRecordsPerDay("acceptedRecords");
    const deniedData = await countRecordsPerDay("deniedRecords");

    for (const { date, count } of acceptedData) {
        await db.dailyStats.upsert({
            where: { date: new Date(date) },
            update: { nbRecordsAccepted: count },
            create: { date: new Date(date), nbRecordsAccepted: count }
        });
    }

    for (const { date, count } of deniedData) {
        await db.dailyStats.upsert({
            where: { date: new Date(date) },
            update: { nbRecordsDenied: count },
            create: { date: new Date(date), nbRecordsDenied: count }
        });
    }

    await interaction.editReply(
        ":white_check_mark: Successfully updated internal daily stats database"
    );
};
