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
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import path from "node:path";
import ExcelJS from "exceljs";
import fs from "node:fs";
import { logger } from "../../../lib/logger";
import { db } from "../../../lib/db";
import { Prisma } from "../../../generated/prisma/client";
import { commandGuilds } from "../../../lib/config";

export const cooldown = 5;

export const command: CommandData = new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Statistics about the server")
    .addSubcommand((subcommand) =>
        subcommand
            .setName("checkedrecords")
            .setDescription("Shows info about all accepted and denied records")
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("pendingrecords")
            .setDescription(
                "Shows info about all pending and submitted records"
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("servertraffic")
            .setDescription("Shows info about server members traffic")
    )
    .addSubcommand((subcommand) =>
        subcommand.setName("exportdb").setDescription("Exports the database")
    )
    .addSubcommand((subcommand) =>
        subcommand.setName("exportcache").setDescription("Exports the cache")
    )
    .addSubcommand((subcommand) =>
        subcommand.setName("exportlog").setDescription("Exports the bot logs")
    )
    .toJSON();

export const metadata: CommandMetadata = { guilds: commandGuilds() };

export const chatInput: ChatInputCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (interaction.options.getSubcommand() === "checkedrecords") {
        const minDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const statsData = await db.dailyStats.findMany({
            where: { date: { gte: minDate } },
            orderBy: { date: "asc" }
        });

        const labels: string[] = [];
        const datasAccepted: number[] = [];
        const datasDenied: number[] = [];

        for (const stats of statsData.slice(0, 30)) {
            labels.push(stats.date.toISOString().slice(0, 10));
            datasAccepted.push(stats.nbRecordsAccepted);
            datasDenied.push(stats.nbRecordsDenied);
        }

        const modsRenderer = new ChartJSNodeCanvas({
            width: 1600,
            height: 600,
            backgroundColour: "white"
        });
        const modsImage = await modsRenderer.renderToBuffer({
            // Build your graph passing option you want
            type: "bar",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "Accepted Records",
                        backgroundColor: "green",
                        data: datasAccepted
                    },
                    {
                        label: "Denied Records",
                        backgroundColor: "red",
                        data: datasDenied
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: "top" },
                    title: {
                        display: true,
                        text: "Records activity from all moderators"
                    }
                }
            }
        });

        const modsAttachment = await new AttachmentBuilder(modsImage, {
            name: "modsgraph.png"
        });

        const nbAcceptedTotal = await db.acceptedRecord.count();
        const nbDeniedTotal = await db.deniedRecord.count();

        const nbAcceptedRecent = await db.acceptedRecord.count({
            where: { createdAt: { gte: minDate } }
        });

        const nbDeniedRecent = await db.deniedRecord.count({
            where: { createdAt: { gte: minDate } }
        });

        const modsStatsEmbed = new EmbedBuilder()
            .setColor(0xffbf00)
            .setTitle("All accepted/denied records stats")
            .addFields(
                { name: "All Time :", value: " " },
                {
                    name: "Total records checked:",
                    value: `${nbAcceptedTotal + nbDeniedTotal}`,
                    inline: true
                },
                {
                    name: "Accepted records:",
                    value: `${nbAcceptedTotal}`,
                    inline: true
                },
                {
                    name: "Denied records:",
                    value: `${nbDeniedTotal}`,
                    inline: true
                },
                { name: "Past 30 days :", value: " " },
                {
                    name: "Records checked:",
                    value: `${nbAcceptedRecent + nbDeniedRecent}`,
                    inline: true
                },
                {
                    name: "Accepted records:",
                    value: `${nbAcceptedRecent}`,
                    inline: true
                },
                {
                    name: "Denied records:",
                    value: `${nbDeniedRecent}`,
                    inline: true
                }
            )
            .setImage("attachment://modsgraph.png");

        return await interaction.editReply({
            embeds: [modsStatsEmbed],
            files: [modsAttachment]
        });
    } else if (interaction.options.getSubcommand() === "pendingrecords") {
        const minDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const statsData = await db.dailyStats.findMany({
            where: { date: { gte: minDate } },
            orderBy: { date: "asc" }
        });

        const labels: string[] = [];
        const datasPending: number[] = [];
        const datasSubmitted: number[] = [];

        for (const stats of statsData.slice(0, 30)) {
            labels.push(stats.date.toISOString().slice(0, 10));
            datasPending.push(stats.nbRecordsPending);
            datasSubmitted.push(stats.nbRecordsSubmitted);
        }

        const pendingRenderer = new ChartJSNodeCanvas({
            width: 1600,
            height: 600,
            backgroundColour: "white"
        });
        const pendingImage = await pendingRenderer.renderToBuffer({
            // Build your graph passing option you want
            type: "line",
            data: {
                labels: labels,
                datasets: [
                    {
                        type: "line",
                        label: "Pending Records",
                        backgroundColor: "blue",
                        borderColor: "blue",
                        data: datasPending
                    },
                    {
                        type: "line",
                        label: "Submitted Records",
                        backgroundColor: "black",
                        borderColor: "black",
                        data: datasSubmitted
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: "top" },
                    title: {
                        display: true,
                        text: "Pending and submitted records over time"
                    }
                }
            }
        });

        const pendingAttachment = await new AttachmentBuilder(pendingImage, {
            name: "pendinggraph.png"
        });

        const totalSubmitted = datasSubmitted.reduce((a, b) => a + b, 0);
        const averagePending = (
            datasPending.reduce((a, b) => a + b, 0) / datasPending.length
        ).toFixed(2);
        const averageSubmitted = (
            totalSubmitted / datasSubmitted.length
        ).toFixed(2);

        const pendingStatsEmbed = new EmbedBuilder()
            .setColor(0xffbf00)
            .setTitle("All pending records stats")
            .addFields(
                {
                    name: "Total submitted records (in the past 30 days):",
                    value: `${totalSubmitted}`,
                    inline: true
                },
                {
                    name: "Average submitted records per day:",
                    value: `${averageSubmitted}`,
                    inline: true
                },
                {
                    name: "Average pending records per day:",
                    value: `${averagePending}`,
                    inline: true
                }
            )
            .setImage("attachment://pendinggraph.png");

        return await interaction.editReply({
            embeds: [pendingStatsEmbed],
            files: [pendingAttachment]
        });
    } else if (interaction.options.getSubcommand() === "servertraffic") {
        const minDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const statsData = await db.dailyStats.findMany({
            where: { date: { gte: minDate } },
            orderBy: { date: "asc" }
        });

        const labels = [];
        const datasJoined = [];
        const datasLeft = [];

        for (let i = 0; i < 30; i++) {
            labels.push(statsData[i].date);
            datasJoined.push(statsData[i].nbMembersJoined);
            datasLeft.push(-statsData[i].nbMembersLeft);
        }

        const membersRenderer = new ChartJSNodeCanvas({
            width: 1600,
            height: 600,
            backgroundColour: "white"
        });
        const membersImage = await membersRenderer.renderToBuffer({
            // Build your graph passing option you want
            type: "bar",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "Members arrivals",
                        backgroundColor: "blue",
                        data: datasJoined
                    },
                    {
                        label: "Members leaves",
                        backgroundColor: "gray",
                        data: datasLeft
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: "top" },
                    title: {
                        display: true,
                        text: "Members traffic over time"
                    }
                }
            }
        });

        const membersAttachment = await new AttachmentBuilder(membersImage, {
            name: "membersgraph.png"
        });

        const totalJoined = datasJoined.reduce((a, b) => a + b, 0);
        const totalLeft = -datasLeft.reduce((a, b) => a + b, 0);

        const membersStatsEmbed = new EmbedBuilder()
            .setColor(0xffbf00)
            .setTitle("Members traffic")
            .addFields(
                { name: "Past 30 days :", value: " " },
                {
                    name: "Total arrivals:",
                    value: `${totalJoined}`,
                    inline: true
                },
                {
                    name: "Total leaves:",
                    value: `${totalLeft}`,
                    inline: true
                }
            )
            .setImage("attachment://membersgraph.png");

        return await interaction.editReply({
            embeds: [membersStatsEmbed],
            files: [membersAttachment]
        });
    } else if (interaction.options.getSubcommand() === "exportdb") {
        const exportDir = path.resolve(process.cwd(), "data/exports/");
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }
        const filePath = path.join(
            exportDir,
            `database_export_${Date.now()}.xlsx`
        );

        let workbook;

        try {
            workbook = new ExcelJS.Workbook();

            for (const modelName of Object.values(Prisma.ModelName)) {
                const worksheet = workbook.addWorksheet(modelName);
                const fields = Object.keys(
                    (Prisma as unknown as Record<string, object>)[
                        `${modelName}ScalarFieldEnum`
                    ]
                ).filter((field) => !field.endsWith("At"));
                worksheet.columns = fields.map((field) => ({
                    header: field,
                    key: field,
                    width: 30
                }));

                const delegate = (
                    db as unknown as Record<
                        string,
                        { findMany(): Promise<Record<string, unknown>[]> }
                    >
                )[modelName.charAt(0).toLowerCase() + modelName.slice(1)];
                const tableData = await delegate.findMany();
                for (const record of tableData)
                    worksheet.addRow(
                        Object.fromEntries(
                            Object.entries(record).map(([key, value]) => [
                                key,
                                typeof value === "bigint"
                                    ? String(value)
                                    : value
                            ])
                        )
                    );
            }
        } catch (e) {
            logger.error(e);
            return;
        }

        await workbook.xlsx.writeFile(filePath);

        const fileAttachment = new AttachmentBuilder(filePath, {
            name: "database_export.xlsx"
        });
        await interaction.editReply({
            content: ":white_check_mark: Exported data successfully:",
            files: [fileAttachment]
        });

        fs.unlinkSync(filePath);
    } else if (interaction.options.getSubcommand() === "exportcache") {
        const exportDir = path.resolve(process.cwd(), "data/exports/");
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }
        const filePath = path.join(
            exportDir,
            `cache_export_${Date.now()}.xlsx`
        );

        try {
            const workbook = new ExcelJS.Workbook();

            const levels = workbook.addWorksheet("Levels");
            const archived = workbook.addWorksheet("Archived");
            const packs = workbook.addWorksheet("Packs");
            const users = workbook.addWorksheet("Users");

            // Add columns to the sheets
            levels.columns = [
                { header: "Name", key: "name", width: 25 },
                { header: "Position", key: "position", width: 30 },
                { header: "Filename", key: "filename", width: 20 }
            ];

            archived.columns = [
                { header: "Name", key: "name", width: 25 },
                { header: "Position", key: "position", width: 30 },
                { header: "Filename", key: "filename", width: 20 }
            ];

            users.columns = [
                { header: "Name", key: "name", width: 25 },
                { header: "ID", key: "user_id", width: 30 }
            ];

            packs.columns = [
                { header: "Name", key: "name", width: 25 },
                { header: "Difficulty", key: "difficulty", width: 30 },
                { header: "Diff pack?", key: "isDiff", width: 20 }
            ];

            const levelsData = await db.cachedLevel.findMany({
                select: { name: true, position: true, filename: true },
                orderBy: { position: "asc" }
            });

            const archivedData = await db.cachedArchivedLevel.findMany({
                select: { name: true, position: true, filename: true }
            });

            const usersData = await db.cachedUser.findMany({
                select: { name: true, user_id: true }
            });

            const packsData = await db.cachedPack.findMany({
                select: { name: true, difficulty: true, isDiff: true }
            });

            levelsData.forEach((record) => levels.addRow(record));

            archivedData.forEach((record) => archived.addRow(record));

            usersData.forEach((record) => users.addRow(record));

            packsData.forEach((record) => packs.addRow(record));

            await workbook.xlsx.writeFile(filePath);

            const fileAttachment = new AttachmentBuilder(filePath, {
                name: "database_export.xlsx"
            });
            await interaction.editReply({
                content: ":white_check_mark: Exported data successfully:",
                files: [fileAttachment]
            });

            fs.unlinkSync(filePath);
        } catch (error) {
            logger.error(error);
            await interaction.editReply({
                content: ":x: An error occurred while exporting the database."
            });
        }
    } else if (interaction.options.getSubcommand() === "exportlog") {
        const exportDir = path.resolve(process.cwd(), "logs/");
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }
        const filePath = path.join(exportDir, `latest.log`);

        return await interaction.editReply({
            content: "Bot logs:",
            files: [filePath]
        });
    }
};
