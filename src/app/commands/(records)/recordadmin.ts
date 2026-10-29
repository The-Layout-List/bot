import {
    SlashCommandBuilder,
    EmbedBuilder,
    AttachmentBuilder,
    MessageFlags
} from "discord.js";
import type {
    ChatInputCommand,
    CommandData,
    CommandMetadata
} from "commandkit";
import { commandGuilds } from "../../../lib/config";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { logger } from "../../../lib/logger";
import { db } from "../../../lib/db";
import { removeErroredRecords } from "../../../lib/records";
import { countRecordsPerDay } from "../../../lib/stats";

export const cooldown = 5;

export const command: CommandData = new SlashCommandBuilder()
    .setName("recordadmin")
    .setDescription("Staff record administration commands")
    .setDMPermission(true)
    .addSubcommand((subcommand) =>
        subcommand
            .setName("setstatus")
            .setDescription("Set the state of record submission")
            .addStringOption((option) =>
                option
                    .setName("status")
                    .setDescription("Status")
                    .setRequired(true)
                    .addChoices(
                        { name: "Open", value: "open" },
                        { name: "Closed", value: "closed" }
                    )
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("modinfo")
            .setDescription("Shows a list staff activity")
            .addUserOption((option) =>
                option
                    .setName("moderator")
                    .setDescription(
                        "The moderator you want to check the activity of"
                    )
                    .setRequired(true)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("check")
            .setDescription("Checks for errored record data")
    )
    .toJSON();

export const metadata: CommandMetadata = { guilds: commandGuilds() };

export const chatInput: ChatInputCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (interaction.options.getSubcommand() === "setstatus") {
        // Changes record status

        // Update sqlite db
        const update = await db.info.updateMany({
            where: { name: "records" },
            data: {
                status:
                    interaction.options.getString("status", true) === "closed"
            }
        });

        if (update.count === 0)
            return await interaction.editReply(
                ":x: Something went wrong while executing the command"
            );
        logger.info(
            `Changed record status to ${interaction.options.getString("status", true)}`
        );
        return await interaction.editReply(
            `:white_check_mark: Changed record status to ${interaction.options.getString("status", true)}`
        );
    } else if (interaction.options.getSubcommand() === "modinfo") {
        // Display a list staff activity info

        const modId = interaction.options.getUser("moderator", true).id;

        const modInfo = await db.staff.findFirst({
            where: { moderator: modId }
        });

        if (!modInfo) {
            return await interaction.editReply(
                ":x: This moderator hasn't accepted or denied any record"
            );
        }

        const minDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const modAcceptedData = await countRecordsPerDay("acceptedRecords", {
            moderator: modId,
            since: minDate
        });
        const modDeniedData = await countRecordsPerDay("deniedRecords", {
            moderator: modId,
            since: minDate
        });

        const labels: string[] = [];
        const datasA: number[] = [];
        const datasD: number[] = [];
        const date = new Date();

        for (let i = 0; i < 30; i++) {
            labels.push(date.toJSON().slice(0, 10));
            date.setDate(date.getDate() - 1);

            datasA.push(
                modAcceptedData.find((element) => element.date === labels[i])
                    ?.count ?? 0
            );
            datasD.push(
                modDeniedData.find((element) => element.date === labels[i])
                    ?.count ?? 0
            );
        }

        labels.reverse();
        datasA.reverse();
        datasD.reverse();

        const renderer = new ChartJSNodeCanvas({
            width: 1600,
            height: 600,
            backgroundColour: "white"
        });
        const image = await renderer.renderToBuffer({
            // Build your graph passing option you want
            type: "bar",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "Accepted Records",
                        backgroundColor: "green",
                        data: datasA
                    },
                    {
                        label: "Denied Records",
                        backgroundColor: "red",
                        data: datasD
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: "top"
                    },
                    title: {
                        display: true,
                        text: "Moderator activity"
                    }
                }
            }
        });

        const attachment = await new AttachmentBuilder(image, {
            name: "modgraph.png"
        });
        const modInfoEmbed = new EmbedBuilder()
            .setColor(0xffbf00)
            .setTitle("Moderator info")
            .setDescription(`<@${modId}>`)
            .addFields(
                {
                    name: "Total records checked:",
                    value: `${modInfo.nbRecords}`,
                    inline: true
                },
                {
                    name: "Accepted records:",
                    value: `${modInfo.nbAccepted}`,
                    inline: true
                },
                {
                    name: "Denied records:",
                    value: `${modInfo.nbDenied}`,
                    inline: true
                },
                {
                    name: "Last activity:",
                    value: `${modInfo.updatedAt.toDateString()}`
                }
            )
            .setImage("attachment://modgraph.png");

        return await interaction.editReply({
            embeds: [modInfoEmbed],
            files: [attachment]
        });
    } else if (interaction.options.getSubcommand() === "check") {
        // Clears errored records //

        logger.info("Looking for errored records...");
        const nbFound = await removeErroredRecords(interaction.client);
        logger.info(`Found a total of ${nbFound} records.`);
        return await interaction.editReply(
            `:white_check_mark: ${nbFound} records missing from the pending channel were found, and removed from the database.`
        );
    }
};
