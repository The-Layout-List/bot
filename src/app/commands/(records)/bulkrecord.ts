import {
    SlashCommandBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    MessageFlags
} from "discord.js";
import type {
    AutocompleteCommand,
    ChatInputCommand,
    CommandData,
    CommandMetadata
} from "commandkit";
import isUrlHttp from "is-url-http";
import * as pako from "pako";
import { logger } from "../../../lib/logger";
import { db } from "../../../lib/db";
import { commandGuilds } from "../../../lib/config";
// Decompressed data passed to the function using Gzip
function decompressData(compressedData: string) {
    const binaryString = atob(compressedData); // Decode base64
    const charData = Uint8Array.from(binaryString, (char) =>
        char.charCodeAt(0)
    );
    const decompressed = pako.ungzip(charData, { toText: true });
    return JSON.parse(decompressed);
}

async function buildEmbed(moderatorID: string, page = 1) {
    const session = await db.bulkRecordSession.findFirst({
        where: {
            moderatorID: moderatorID
        }
    });

    const records = await db.bulkRecord.findMany({
        where: {
            moderatorID: moderatorID
        }
    });
    if (!session || records.length === 0) {
        const errEmbed = new EmbedBuilder()
            .setColor(0xffff00)
            .setTitle(`No records!`)
            .setDescription(
                `You're not currently checking bulk records, start a session with /bulkrecord add`
            );

        return errEmbed;
    }

    const embed = new EmbedBuilder()
        .setColor(0xffff00)
        .setTitle(`${session.playerName}'s records`)
        .setDescription(
            `${session.fps} FPS (${
                session.mobile ? "Mobile" : "PC"
            }) | [Video](${session.video})${
                session.discordID ? " | <@" + session.discordID + ">" : ""
            }`
        );

    const pages = Math.ceil(records.length / 25);
    embed.setFooter({ text: `Page ${page}/${pages}` });

    for (const record of records.slice((page - 1) * 25, (page - 1) * 25 + 25)) {
        let str = `${record.percent}%`;
        if (record.enjoyment !== undefined && record.enjoyment !== null) {
            str += ` - ${record.enjoyment}/10`;
        }
        embed.addFields({
            name: record.levelname,
            value: str
        });
    }
    return embed;
}

export const command: CommandData = new SlashCommandBuilder()
    .setName("bulkrecord")
    .setDescription("Commands for adding records submitted with the Grind page")
    .addSubcommand((subcommand) =>
        subcommand
            .setName("add")
            .setDescription("Start checking a bulk record submission")
            .addStringOption((option) =>
                option
                    .setName("code")
                    .setDescription("The text copied from the website")
                    .setRequired(true)
            )
            .addStringOption((option) =>
                option
                    .setName("device")
                    .setDescription("Device the level was completed on")
                    .setRequired(true)
                    .addChoices(
                        { name: "PC", value: "PC" },
                        { name: "Mobile", value: "Mobile" }
                    )
            )
            .addStringOption((option) =>
                option
                    .setName("completionlink")
                    .setDescription("Link to the completion")
                    .setMaxLength(1024)
                    .setRequired(true)
            )
            .addIntegerOption((option) =>
                option
                    .setName("fps")
                    .setDescription("The FPS you used to complete the level")
                    .setRequired(true)
            )
            .addUserOption((option) =>
                option
                    .setName("discord")
                    .setDescription("The person to ping in the records channel")
            )
            .addStringOption((option) =>
                option
                    .setName("notes")
                    .setDescription("Any other info you'd like to share")
                    .setMaxLength(1024)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("delete")
            .setDescription("Delete a record")
            .addStringOption((option) =>
                option
                    .setName("levelname")
                    .setDescription("The level this record is on")
                    .setRequired(true)
                    .setAutocomplete(true)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("editlevel")
            .setDescription("Edit a record")
            .addStringOption((option) =>
                option
                    .setName("levelname")
                    .setDescription("The level this record is on")
                    .setRequired(true)
                    .setAutocomplete(true)
            )
            .addIntegerOption((option) =>
                option
                    .setName("percent")
                    .setDescription("The percent you got on the level")
                    .setRequired(true)
            )
            .addIntegerOption((option) =>
                option
                    .setName("enjoyment")
                    .setDescription(
                        "Your enjoyment rating on this level (1-10)"
                    )
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("edit")
            .setDescription("Edit the main record data")
            .addStringOption((option) =>
                option
                    .setName("username")
                    .setDescription(
                        "The username you're submitting for (Be sure to select one of the available options.)"
                    )
                    .setMaxLength(1024)
                    .setAutocomplete(true)
            )
            .addStringOption((option) =>
                option
                    .setName("device")
                    .setDescription("Device the level was completed on")
                    .addChoices(
                        { name: "PC", value: "PC" },
                        { name: "Mobile", value: "Mobile" }
                    )
            )
            .addStringOption((option) =>
                option
                    .setName("completionlink")
                    .setDescription("Link to the completion")
                    .setMaxLength(1024)
            )
            .addIntegerOption((option) =>
                option
                    .setName("fps")
                    .setDescription("The FPS you used to complete the level")
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("addlevel")
            .setDescription("Add a level to the records")
            .addStringOption((option) =>
                option
                    .setName("lvlname")
                    .setDescription("The level this record is on")
                    .setRequired(true)
                    .setAutocomplete(true)
            )
            .addIntegerOption((option) =>
                option
                    .setName("percent")
                    .setDescription("The percent you got on the level")
            )
            .addIntegerOption((option) =>
                option
                    .setName("enjoyment")
                    .setDescription(
                        "Your enjoyment rating on this level (1-10)"
                    )
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("view")
            .setDescription("Show all records you're currently checking")
            .addIntegerOption((option) =>
                option.setName("page").setDescription("The page of levels")
            )
    )
    .toJSON();

export const metadata: CommandMetadata = { guilds: commandGuilds() };

export const autocomplete: AutocompleteCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    const focused = await interaction.options.getFocused(true);

    if (focused.name === "levelname") {
        const levels = await db.bulkRecord.findMany({
            where: {
                levelname: {
                    contains: focused.value.toLowerCase(),
                    mode: "insensitive"
                },
                moderatorID: interaction.user.id
            }
        });

        return await interaction.respond(
            levels.slice(0, 25).map((level) => ({
                name: level.levelname,
                value: level.path
            }))
        );
    } else if (focused.name === "username") {
        const users = await db.cachedUser.findMany({
            where: {
                name: {
                    contains: focused.value.toLowerCase(),
                    mode: "insensitive"
                }
            }
        });
        return await interaction.respond(
            users
                .slice(0, 25)
                .map((user) => ({ name: user.name, value: user.name }))
        );
    } else if (focused.name === "lvlname") {
        const levels = await db.cachedLevel.findMany({
            where: {
                name: {
                    contains: focused.value.toLowerCase(),
                    mode: "insensitive"
                }
            }
        });

        return await interaction.respond(
            levels.slice(0, 25).map((level) => ({
                name: `#${level.position} - ${level.name}`,
                value: level.filename
            }))
        );
    }
};

export const chatInput: ChatInputCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    if (interaction.options.getSubcommand() === "add") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const fileData = interaction.options.getString("code", true);
        const device = interaction.options.getString("device", true);
        const video = interaction.options.getString("completionlink", true);
        const fps = interaction.options.getInteger("fps", true);
        const userToPing = interaction.options.getUser("discord");
        const note = interaction.options.getString("notes");

        // Check given URLs
        await interaction.editReply("Opening record...");
        if (video && (/\s/g.test(video) || !isUrlHttp(video)))
            return await interaction.editReply(
                ":x: Couldn't add the record: The provided completion link is not a valid URL"
            );

        let parsedJson;
        try {
            parsedJson = await JSON.parse(decompressData(fileData));
        } catch (e) {
            logger.error(`Failed to parse grind page data: ${e}`);
            logger.error(fileData);
            return await interaction.editReply(
                ":x: Could not parse the grind page data"
            );
        }

        await db.bulkRecordSession.deleteMany({
            where: {
                moderatorID: interaction.user.id
            }
        });

        await db.bulkRecord.deleteMany({
            where: {
                moderatorID: interaction.user.id
            }
        });

        await db.bulkRecordSession.create({
            data: {
                moderatorID: interaction.user.id,
                playerName: parsedJson.name,
                video: video,
                mobile: device == "Mobile" ? true : false,
                fps: fps,
                note: note || null,
                discordID: userToPing?.id || null
            }
        });

        for (const level of parsedJson.levels) {
            await db.bulkRecord.create({
                data: {
                    moderatorID: interaction.user.id,
                    enjoyment: level.enjoyment,
                    percent: level.percent,
                    path: level.path,
                    levelname: level.name
                }
            });
        }

        const embed = await buildEmbed(interaction.user.id);

        // Create commit button
        const commit = new ButtonBuilder()
            .setCustomId("commitAddBulkRecords")
            .setLabel("Commit changes")
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(commit);

        return await interaction.editReply({
            content: "",
            embeds: [embed],
            components: [row]
        });
    } else if (interaction.options.getSubcommand() === "delete") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const levelPath = interaction.options.getString("levelname", true);

        await db.bulkRecord.deleteMany({
            where: {
                path: levelPath
            }
        });

        const embed = await buildEmbed(interaction.user.id);

        // Create commit button
        const commit = new ButtonBuilder()
            .setCustomId("commitAddBulkRecords")
            .setLabel("Commit changes")
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(commit);

        return await interaction.editReply({
            content: "",
            embeds: [embed],
            components: [row]
        });
    } else if (interaction.options.getSubcommand() === "editlevel") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const levelPath = interaction.options.getString("levelname", true);
        const percent = interaction.options.getInteger("percent", true);
        const enjoyment = interaction.options.getInteger("enjoyment");

        await db.bulkRecord.updateMany({
            where: {
                moderatorID: interaction.user.id,
                path: levelPath
            },
            data: {
                ...(percent !== null && { percent }),
                ...(enjoyment !== null && { enjoyment })
            }
        });

        return await interaction.editReply(
            ":white_check_mark: This record has been updated!"
        );
    } else if (interaction.options.getSubcommand() === "edit") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const username = interaction.options.getString("username");
        const device = interaction.options.getString("device");
        const video = interaction.options.getString("completionlink");
        const fps = interaction.options.getInteger("fps");

        await db.bulkRecordSession.updateMany({
            where: {
                moderatorID: interaction.user.id
            },
            data: {
                ...(username !== null && { playerName: username }),
                ...(device !== null && { mobile: device === "Mobile" }),
                ...(video !== null && { video }),
                ...(fps !== null && { fps })
            }
        });

        return await interaction.editReply(
            ":white_check_mark: This record has been updated!"
        );
    } else if (interaction.options.getSubcommand() === "addlevel") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const levelPath = interaction.options.getString("lvlname", true);
        const percent = interaction.options.getInteger("percent");
        const enjoyment = interaction.options.getInteger("enjoyment");

        const dbLevel = await db.cachedLevel.findFirst({
            where: {
                filename: levelPath
            }
        });
        if (!dbLevel)
            return await interaction.editReply(":x: That level doesn't exist!");

        await db.bulkRecord.create({
            data: {
                moderatorID: interaction.user.id,
                percent: percent !== null ? percent : 0,
                enjoyment: enjoyment !== null ? enjoyment : 0,
                path: dbLevel.filename,
                levelname: dbLevel.name
            }
        });

        return await interaction.editReply(
            ":white_check_mark: This record has been added!"
        );
    } else if (interaction.options.getSubcommand() === "view") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const page = interaction.options.getInteger("page") || 1;

        const embed = await buildEmbed(interaction.user.id, page);

        // Create commit button
        const commit = new ButtonBuilder()
            .setCustomId("commitAddBulkRecords")
            .setLabel("Commit changes")
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(commit);

        return await interaction.editReply({
            content: "",
            embeds: [embed],
            components: [row]
        });
    }
};
