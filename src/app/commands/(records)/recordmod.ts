import type { ListLevel } from "../../../lib/listTypes";
import { getTextChannel } from "../../../lib/discord";
import {
    SlashCommandBuilder,
    EmbedBuilder,
    AttachmentBuilder,
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
import { config, commandGuilds } from "../../../lib/config";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { logger } from "../../../lib/logger";
import { incrementProgress } from "../../../lib/shiftSystem";
import { cache } from "../../../lib/cacheUpdate";
import { db, incrementDailyStat } from "../../../lib/db";
import { countRecordsPerDay, topSubmitters } from "../../../lib/stats";
import { octokit, asFile } from "../../../lib/github";
import path from "node:path";
import fs from "node:fs";
import { cloneOrPullRepo, localRepoPath } from "../../../lib/gitUtils";

const {
    archiveRecordsID,
    priorityRoleID,
    submissionLockRoleID,
    enablePriorityRole,
    githubOwner,
    githubRepo,
    githubDataPath,
    githubBranch,
    guildId
} = config;

export const command: CommandData = new SlashCommandBuilder()
    .setName("record")
    .setDescription("Staff record moderator commands")
    .addSubcommand((subcommand) =>
        subcommand
            .setName("stats")
            .setDescription("Shows how many records you've checked")
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("add")
            .setDescription("Add a record to the site")
            .addStringOption((option) =>
                option
                    .setName("username")
                    .setDescription(
                        "The username you're submitting for (Be sure to select one of the available options.)"
                    )
                    .setMaxLength(1024)
                    .setAutocomplete(true)
                    .setRequired(true)
            )
            .addStringOption((option) =>
                option
                    .setName("levelname")
                    .setDescription(
                        "Name of the level you're submitting for (Be sure to select one of the available options.)"
                    )
                    .setMaxLength(1024)
                    .setRequired(true)
                    .setAutocomplete(true)
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
            .setName("deny")
            .setDescription("Denies a record")
            .addStringOption((option) =>
                option
                    .setName("levelname")
                    .setDescription(
                        "Name of the level for which the record is being denied"
                    )
                    .setMaxLength(1024)
                    .setRequired(true)
                    .setAutocomplete(true)
            )
            .addStringOption((option) =>
                option
                    .setName("username")
                    .setDescription(
                        "Username of the person whose record is being denied. Shows if no "
                    )
                    .setMaxLength(1024)
                    .setRequired(true)
                    .setAutocomplete(true)
            )
            .addStringOption((option) =>
                option
                    .setName("reason")
                    .setDescription("Reason for denying the record")
                    .setMaxLength(1024)
                    .setRequired(true)
            )
            .addUserOption((option) =>
                option
                    .setName("discord")
                    .setDescription("The person to ping in the records channel")
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("addlast")
            .setDescription(
                "Adds the last accepted record to a different level"
            )
            .addStringOption((option) =>
                option
                    .setName("levelname")
                    .setDescription(
                        "Name of the level you're submitting for (Be sure to select one of the available options.)"
                    )
                    .setMaxLength(1024)
                    .setRequired(true)
                    .setAutocomplete(true)
            )
            .addIntegerOption((option) =>
                option
                    .setName("enjoyment")
                    .setDescription("The enjoyment rating on this level (1-10)")
            )
            .addIntegerOption((option) =>
                option
                    .setName("fps")
                    .setDescription("The FPS used to complete the level")
            )
            .addIntegerOption((option) =>
                option
                    .setName("percent")
                    .setDescription("The percent you got on the level")
            )
            .addStringOption((option) =>
                option
                    .setName("completionlink")
                    .setDescription("Link to the completion")
                    .setMaxLength(1024)
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
            .setName("modleaderboard")
            .setDescription("Shows list staff records leaderboard")
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("recordsinfo")
            .setDescription(
                "Shows info on people with the most pending/accepted/denied records"
            )
            .addStringOption((option) =>
                option
                    .setName("type")
                    .setDescription("Which records you want to check")
                    .setRequired(true)
                    .addChoices(
                        { name: "Pending", value: "pending" },
                        { name: "Accepted", value: "accepted" },
                        { name: "Denied", value: "denied" }
                    )
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("ban")
            .setDescription("Remove all records from a user")
            .addStringOption((option) =>
                option
                    .setName("username")
                    .setDescription("The user to ban")
                    .setRequired(true)
                    .setAutocomplete(true)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("enabledm")
            .setDescription(
                "Enables sending the github code to you in dms whenever you accept a record"
            )
            .addStringOption((option) =>
                option
                    .setName("status")
                    .setDescription("Enable or disable this setting")
                    .setRequired(true)
                    .addChoices(
                        { name: "Enabled", value: "enabled" },
                        { name: "Disabled", value: "disabled" }
                    )
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
            .addStringOption((option) =>
                option
                    .setName("username")
                    .setDescription(
                        "The username of the person who submitted this record"
                    )
                    .setRequired(true)
                    .setAutocomplete(true)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("edit")
            .setDescription("Edit a record")
            .addStringOption((option) =>
                option
                    .setName("levelname")
                    .setDescription("The level this record is on")
                    .setRequired(true)
                    .setAutocomplete(true)
            )
            .addStringOption((option) =>
                option
                    .setName("username")
                    .setDescription(
                        "The username of the person who submitted this record"
                    )
                    .setRequired(true)
                    .setAutocomplete(true)
            )
            .addStringOption((option) =>
                option
                    .setName("newuser")
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
            .setName("move")
            .setDescription("Move a record up or down in the level order")
            .addStringOption((option) =>
                option
                    .setName("levelname")
                    .setDescription("The level the record is on")
                    .setRequired(true)
                    .setAutocomplete(true)
            )
            .addStringOption((option) =>
                option
                    .setName("username")
                    .setDescription("The record holder you want to reorder")
                    .setRequired(true)
                    .setAutocomplete(true)
            )
            .addIntegerOption((option) =>
                option
                    .setName("offset")
                    .setDescription(
                        "Amount to shift record by, e.g. +2 moves it up by 2, -1 moves it down by 1"
                    )
                    .setRequired(true)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("updatedata")
            .setDescription(
                "Syncs all the level and user data from the levels to the bot"
            )
    )
    .toJSON();

export const metadata: CommandMetadata = { guilds: commandGuilds() };

export const autocomplete: AutocompleteCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    const focused = await interaction.options.getFocused(true);

    if (focused.name === "levelname") {
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
    } else if (focused.name === "username" || focused.name === "newuser") {
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
    }
};

export const chatInput: ChatInputCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    if (interaction.options.getSubcommand() === "add") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // add record to list

        // Check given level name

        const username = await interaction.options.getString("username", true);
        const device = await interaction.options.getString("device", true);
        const fps = await interaction.options.getInteger("fps", true);
        const enjoyment = await interaction.options.getInteger("enjoyment");
        const percent = await interaction.options.getInteger("percent", true);
        const linkStr = interaction.options.getString("completionlink", true);
        const note = interaction.options.getString("notes");
        const rawStr = interaction.options.getString("raw");
        const userToPing = await interaction.options.getUser("discord");

        const level = await db.cachedLevel.findFirst({
            where: {
                filename: interaction.options.getString("levelname", true)
            }
        });
        if (!level)
            return await interaction.editReply(
                ":x: Couldn't find the level you're submitting for"
            );
        const filename = level.filename;
        // Get cached user
        let user;
        try {
            user = await db.cachedUser.findFirst({
                where: { name: username }
            });
            if (!user) {
                await interaction.editReply(
                    "No user found, attempting to create a new one..."
                );
                user = await db.cachedUser.create({
                    data: {
                        name: username,
                        user_id: String(
                            Math.floor(1000000000 + Math.random() * 9000000000)
                        )
                    }
                });

                logger.info(user);
            }
        } catch (error) {
            logger.error(
                `Error automatically creating user on record submit: ${error}`
            );
            return await interaction.editReply(
                `:x: Error creating a new user: ${error} (show this to sphericle!)`
            );
        }

        // Check given URLs
        await interaction.editReply("Checking if the URL is valid...");
        if (/\s/g.test(linkStr) || !isUrlHttp(linkStr))
            return await interaction.editReply(
                ":x: Couldn't add the record: The provided completion link is not a valid URL"
            );
        if (rawStr && (/\s/g.test(rawStr) || !isUrlHttp(rawStr)))
            return await interaction.editReply(
                ":x: Couldn't add the record: The provided raw footage link is not a valid URL"
            );

        // Check enjoyment bounds (0-10)
        await interaction.editReply("Checking if the enjoyment is valid...");
        if (enjoyment !== null && (enjoyment < 0 || enjoyment > 10))
            return await interaction.editReply(
                ":x: Couldn't add the record: Enjoyment rating must be between 0 and 10"
            );

        // Check percent bounds (0-100)
        await interaction.editReply("Checking if the percent is valid...");
        if (percent < 0 || percent > 100)
            return await interaction.editReply(
                ":x: Couldn't add the record: Percent must be valid (1-100)"
            );

        let fileResponse;
        try {
            fileResponse = await octokit.rest.repos.getContent({
                owner: githubOwner,
                repo: githubRepo,
                path: githubDataPath + `/${filename}.json`,
                branch: githubBranch
            });
        } catch (fetchError) {
            logger.info(`Couldn't fetch ${filename}.json: \n${fetchError}`);
            return await interaction.editReply(
                `:x: Couldn't fetch ${filename}.json: \n${fetchError}`
            );
        }

        let parsedData: ListLevel;
        try {
            parsedData = JSON.parse(
                Buffer.from(
                    asFile(fileResponse.data).content,
                    "base64"
                ).toString("utf-8")
            );
        } catch (parseError) {
            logger.info(
                `Unable to parse data fetched from ${filename}:\n${parseError}`
            );
            return await interaction.editReply(
                `:x: Unable to parse data fetched from ${filename}:\n${parseError}`
            );
        }
        if (!Array.isArray(parsedData.records)) {
            logger.info(
                `The records field of the fetched ${filename}.json is not an array`
            );
            return await interaction.editReply(
                `:x: The records field of the fetched ${filename}.json is not an array`
            );
        }

        const githubCode =
            `{\n\t\t"user": "${user.name}",\n\t\t"link": "${linkStr}",\n\t\t"percent": ${percent},\n\t\t"hz": ${fps}` +
            (enjoyment !== null ? `,\n\t\t"enjoyment": ${enjoyment}` : "") +
            (device == "Mobile" ? ',\n\t\t"mobile": true\n}\n' : "\n}");
        const newRecord = JSON.parse(githubCode);

        let existing = false;
        let updated = false;
        // If duplicate, don't add it to githubCodes
        for (const fileRecord of parsedData.records) {
            if (fileRecord.user === user.name) {
                logger.info(
                    `Found existing record of ${filename} for ${user.name}`
                );
                if (fileRecord.percent < percent) {
                    logger.info(
                        "This record has a greater percent on this level, updating..."
                    );
                    fileRecord.percent = percent;
                    fileRecord.enjoyment = enjoyment ?? undefined;
                    fileRecord.link = linkStr;
                    updated = true;
                } else {
                    logger.info(
                        `Canceled adding duplicated record of ${filename} for ${user.name}`
                    );
                    // TODO: this doesnt work
                    // await db.acceptedRecord.deleteMany({ where: { id: record.id } });
                    existing = true;
                }
            }
        }

        await interaction.editReply(`Writing code...`);

        // Create embed to send in public channel
        const publicEmbed = new EmbedBuilder()
            .setColor(0x8fce00)
            .setTitle(`:white_check_mark: ${level.name}`)
            .addFields(
                { name: "Percent", value: `${percent}%`, inline: true },
                {
                    name: "Record holder",
                    value: `${user.name}`,
                    inline: true
                },
                {
                    name: "Record added by",
                    value: `${interaction.user}`,
                    inline: true
                },
                {
                    name: "Device",
                    value: `${device} (${fps} FPS)`,
                    inline: true
                },
                {
                    name: "Video",
                    value: `[Link](${linkStr})`,
                    inline: true
                },
                {
                    name: "Enjoyment",
                    value: enjoyment !== null ? `${enjoyment}/10` : "None",
                    inline: true
                }
            )
            .setTimestamp();

        if (note) {
            publicEmbed.addFields({
                name: "Note",
                value: `**_${note}_**`,
                inline: true
            });
        }
        logger.info(
            `${interaction.user.tag} (${interaction.user.id}) accepted record of ${level.name} for ${user.name}`
        );

        await interaction.editReply("Adding record...");

        // if the record does not already exist or existed but has been updated
        if (existing === true && updated === false) {
            return await interaction.editReply(
                `:x: This user already has a record on this level!`
            );
        }
        // Accepting a record //

        await interaction.editReply(`Writing to DB...`);
        let record;
        try {
            const recordEntry = await db.acceptedRecord.create({
                data: {
                    username: user.name,
                    submitter: interaction.user.id,
                    levelname: level.name,
                    filename: level.filename,
                    device: device,
                    fps: fps,
                    enjoyment: enjoyment,
                    percent: percent,
                    completionlink: linkStr,
                    raw: rawStr,
                    ldm: null,
                    modMenu: "none",
                    additionalnotes: note,
                    priority:
                        enablePriorityRole &&
                        interaction.member.roles.cache.has(priorityRoleID),
                    moderator: interaction.user.id
                }
            });
            record = recordEntry;
            await incrementProgress(interaction.user.id, 1);
        } catch (error) {
            logger.error(
                `Error adding the record to the accepted table: ${error}`
            );
            return await interaction.editReply(
                ":x: Couldn't add the record to the database"
            );
        }

        await interaction.editReply("Committing...");
        // Add new record to the level's file if this is a new record (not an updated one)
        if (updated === false)
            parsedData.records = parsedData.records.concat(newRecord);

        // not sure why it needs to be done this way but :shrug:
        const changes = [];
        changes.push({
            path: githubDataPath + `/${filename}.json`,
            content: JSON.stringify(parsedData, null, "\t")
        });

        const changePath = githubDataPath + `/${filename}.json`;
        const content = JSON.stringify(parsedData);

        const debugStatus = await db.info.findFirst({
            where: { name: "commitdebug" }
        });
        if (!debugStatus || !debugStatus.status) {
            let commitSha;
            try {
                // Get the SHA of the latest commit from the branch
                const { data: refData } = await octokit.git.getRef({
                    owner: githubOwner,
                    repo: githubRepo,
                    ref: `heads/${githubBranch}`
                });
                commitSha = refData.object.sha;
            } catch (getRefError) {
                logger.info(
                    `Something went wrong while fetching the latest commit SHA:\n${getRefError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (getRefError)"
                );
            }
            let treeSha;
            try {
                // Get the commit using its SHA
                const { data: commitData } = await octokit.git.getCommit({
                    owner: githubOwner,
                    repo: githubRepo,
                    commit_sha: commitSha
                });
                treeSha = commitData.tree.sha;
            } catch (getCommitError) {
                logger.info(
                    `Something went wrong while fetching the latest commit:\n${getCommitError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (getCommitError)"
                );
            }

            let newTree;
            try {
                // Create a new tree with the changes
                newTree = await octokit.git.createTree({
                    owner: githubOwner,
                    repo: githubRepo,
                    base_tree: treeSha,
                    tree: changes.map((change) => ({
                        path: change.path,
                        mode: "100644",
                        type: "blob",
                        content: change.content
                    }))
                });
            } catch (createTreeError) {
                logger.info(
                    `Something went wrong while creating a new tree:\n${createTreeError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (createTreeError)"
                );
            }

            let newCommit;
            try {
                // Create a new commit with this tree
                newCommit = await octokit.git.createCommit({
                    owner: githubOwner,
                    repo: githubRepo,
                    message: `Added ${record.username}'s record to ${record.levelname} (${interaction.user.tag})`,
                    tree: newTree.data.sha,
                    parents: [commitSha]
                });
            } catch (createCommitError) {
                logger.info(
                    `Something went wrong while creating a new commit:\n${createCommitError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (createCommitError)"
                );
            }

            try {
                // Update the branch to point to the new commit
                await octokit.git.updateRef({
                    owner: githubOwner,
                    repo: githubRepo,
                    ref: `heads/${githubBranch}`,
                    sha: newCommit.data.sha
                });
            } catch (updateRefError) {
                logger.info(
                    `Something went wrong while updating the branch :\n${updateRefError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (updateRefError)"
                );
            }
            logger.info(
                `Successfully created commit on ${githubBranch} (record addition): ${newCommit.data.sha}`
            );
        } else {
            // Get file SHA
            let fileSha;
            try {
                const response = await octokit.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: changePath
                });
                fileSha = asFile(response.data).sha;
            } catch (error) {
                logger.info(`Error fetching ${changePath} SHA:\n${error}`);
                return await interaction.editReply(
                    `:x: Couldn't fetch data from ${changePath}`
                );
            }

            try {
                await octokit.repos.createOrUpdateFileContents({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: changePath,
                    message: `Updated ${changePath} (${interaction.user.tag})`,
                    content: Buffer.from(content).toString("base64"),
                    sha: fileSha
                });
                logger.info(`Updated ${changePath} (${interaction.user.tag}`);
            } catch (error) {
                logger.info(
                    `Failed to update ${changePath} (${interaction.user.tag}):\n${error}`
                );
                await interaction.editReply(
                    `:x: Couldn't update the file ${changePath}, skipping...`
                );
            }
        }

        // Send all messages simultaneously
        const guild = await interaction.client.guilds.fetch(guildId);

        // staffGuild.channels.cache.get(acceptedRecordsID).send({ content: '', embeds: [acceptEmbed], components: [row] });
        getTextChannel(guild, archiveRecordsID).send({
            content: userToPing ? `<@${userToPing.id}>` : "",
            embeds: [publicEmbed]
        });

        // Check if we need to send in dms as well
        const settings = await db.settings.findFirst({
            where: { moderator: interaction.user.id }
        });
        if (!settings) {
            await db.settings.create({
                data: {
                    moderator: interaction.user.id,
                    sendAcceptedInDM: false
                }
            });
        } else if (settings.sendAcceptedInDM) {
            try {
                const notRawGithubCode: Record<string, unknown> = {
                    user: record.username,
                    link: record.completionlink,
                    percent: record.percent,
                    hz: record.fps,
                    ...(record.device === "Mobile" && { mobile: true })
                };
                if (enjoyment !== null && enjoyment !== undefined)
                    notRawGithubCode.enjoyment = enjoyment;

                const rawGithubCode = JSON.stringify(
                    notRawGithubCode,
                    null,
                    "\t"
                );

                const dmMessage = `Accepted record of ${record.levelname} for ${record.username}\nGithub Code:\n\`\`\`${rawGithubCode}\`\`\``;
                await interaction.user.send({ content: dmMessage });
            } catch {
                logger.info(
                    `Failed to send in moderator ${interaction.user.id} dms, ignoring send in dms setting`
                );
            }
        }

        // Update moderator data (create new entry if that moderator hasn't accepted/denied records before)
        const modInfo = await db.staff.findFirst({
            where: { moderator: interaction.user.id }
        });
        if (!modInfo) {
            await db.staff.create({
                data: {
                    moderator: interaction.user.id,
                    nbRecords: 1,
                    nbDenied: 0,
                    nbAccepted: 1
                }
            });
        } else {
            await db.staff.update({
                where: { id: modInfo.id },
                data: { nbRecords: { increment: 1 } }
            });
            await db.staff.update({
                where: { id: modInfo.id },
                data: { nbAccepted: { increment: 1 } }
            });
        }

        await incrementDailyStat("nbRecordsAccepted");

        logger.info(
            `${interaction.user.tag} (${interaction.user.id}) submitted ${record.levelname} for ${record.username}`
        );
        return await interaction.editReply(
            enablePriorityRole &&
                interaction.member.roles.cache.has(priorityRoleID)
                ? `:white_check_mark: The priority record for ${record.levelname} has been submitted successfully`
                : `:white_check_mark: The record for ${record.levelname} has been added successfully`
        );
    } else if (interaction.options.getSubcommand() === "addlast") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // get last row from accepted records db

        await interaction.editReply("Getting last record...");
        const lastRow = await db.acceptedRecord.findFirst({
            orderBy: { createdAt: "desc" }
        });

        if (!lastRow) {
            return await interaction.editReply(
                ":x: There are no records to add"
            );
        }

        const oldRecord = lastRow;

        const newLevel = interaction.options.getString("levelname", true);
        let newPercent =
            interaction.options.getInteger("percent") || oldRecord.percent;
        let newEnjoyment =
            interaction.options.getInteger("enjoyment") ?? oldRecord.enjoyment;
        let newFPS = interaction.options.getInteger("fps") || oldRecord.fps;
        const newDevice =
            interaction.options.getString("device") || oldRecord.device;
        let newNotes =
            interaction.options.getString("notes") || oldRecord.additionalnotes;
        let newModMenu =
            interaction.options.getString("modmenu") || oldRecord.modMenu;

        const setNoneToNull = (val: string | null) =>
            typeof val === "string" && val.toLowerCase() === "none"
                ? null
                : val;

        newNotes = setNoneToNull(newNotes);
        newModMenu = setNoneToNull(newModMenu);

        newPercent = newPercent === -1 ? null : newPercent;
        newFPS = newFPS === -1 ? null : newFPS;
        newEnjoyment = newEnjoyment === -1 ? null : newEnjoyment;

        const notesOption = interaction.options.getString("notes");
        if (notesOption) {
            if (notesOption.toLowerCase() === "none") newNotes = null;
            else newNotes = notesOption;
        }

        const level = await db.cachedLevel.findFirst({
            where: { filename: newLevel }
        });
        if (!level)
            return await interaction.editReply(
                ":x: Couldn't find the level you're submitting for"
            );
        if (newLevel === oldRecord.filename) {
            return await interaction.editReply(
                ":x: Choose a different level! That's the point of the command lmao????"
            );
        }

        // add record to list
        await interaction.editReply(`Adding record...`);

        // Check list banned
        await interaction.editReply("Checking if the user is list banned...");
        if (interaction.member.roles.cache.has(submissionLockRoleID)) {
            await interaction.editReply(
                ":x: Couldn't add the record: You have been banned from submitting records"
            );
            return;
        }

        // Check record submission status
        const dbStatus = await db.info.findFirst({
            where: { name: "records" }
        });
        if (!dbStatus)
            return await interaction.editReply(
                ":x: Something wrong happened while executing the command; please try again later"
            );

        if (dbStatus.status)
            return await interaction.editReply(
                ":x: Couldn't add the record: Submissions are closed at the moment"
            );

        // Check enjoyment bounds (1-10)
        await interaction.editReply("Checking if the enjoyment is valid...");

        if (
            newEnjoyment !== null &&
            newEnjoyment !== undefined &&
            (newEnjoyment < -1 || newEnjoyment > 10)
        )
            return await interaction.editReply(
                ":x: Couldn't add the record: Enjoyment rating must be between 0 and 10"
            );

        // Check percent bounds (0-100)
        await interaction.editReply("Checking if the percent is valid...");
        if (newPercent !== null && (newPercent < -1 || newPercent > 100))
            return await interaction.editReply(
                ":x: Couldn't add the record: Percent must be valid (1-100)"
            );

        // Accepting a record //
        await interaction.editReply(`Matched level ${level.filename}`);

        // Get cached user
        const user = await db.cachedUser.findFirst({
            where: { name: oldRecord.username ?? "" }
        });
        if (!user)
            return await interaction.editReply(
                ":x: Couldn't find the user this record was submitted for (their name might have changed since they submitted it)"
            );

        await interaction.editReply(`Writing code...`);
        // Create embed to send with github code
        const githubCode =
            `{\n\t\t"user": "${user.name}",\n\t\t"link": "${oldRecord.completionlink}",\n\t\t"percent": ${newPercent},\n\t\t"hz": ${newFPS}` +
            (newEnjoyment !== -1 || null
                ? `,\n\t\t"enjoyment": ${newEnjoyment}`
                : "") +
            (newDevice == "Mobile" ? ',\n\t\t"mobile": true\n}\n' : "\n}");

        // Create embed to send in public channel
        const publicEmbed = new EmbedBuilder()
            .setColor(0x8fce00)
            .setTitle(`:white_check_mark: ${level.name}`)
            .addFields(
                { name: "Percent", value: `${newPercent}%`, inline: true },
                {
                    name: "Record holder",
                    value: `${user.name}`,
                    inline: true
                },
                {
                    name: "Record added by",
                    value: `${interaction.user}`,
                    inline: true
                },
                {
                    name: "Device",
                    value: `${newDevice} (${newFPS} FPS)`,
                    inline: true
                },
                {
                    name: "Video",
                    value: `[Link](${oldRecord.completionlink})`,
                    inline: true
                },
                {
                    name: "Enjoyment",
                    value: newEnjoyment ? `${newEnjoyment}/10` : "None",
                    inline: true
                }
            )
            .setTimestamp();

        // Create embed to send in public channel

        logger.info(
            `${interaction.user.tag} (${interaction.user.id}) accepted record of ${level.name} for ${user.name}`
        );

        await interaction.editReply("Adding record...");

        const filename = level.filename;
        let fileResponse;
        try {
            fileResponse = await octokit.rest.repos.getContent({
                owner: githubOwner,
                repo: githubRepo,
                path: githubDataPath + `/${filename}.json`,
                branch: githubBranch
            });
        } catch (fetchError) {
            logger.info(`Couldn't fetch ${filename}.json: \n${fetchError}`);
            return await interaction.editReply(
                `:x: Couldn't fetch ${filename}.json: \n${fetchError}`
            );
        }

        let parsedData: ListLevel;
        try {
            parsedData = JSON.parse(
                Buffer.from(
                    asFile(fileResponse.data).content,
                    "base64"
                ).toString("utf-8")
            );
        } catch (parseError) {
            logger.info(
                `Unable to parse data fetched from ${filename}:\n${parseError}`
            );
            return await interaction.editReply(
                `:x: Unable to parse data fetched from ${filename}:\n${parseError}`
            );
        }
        if (!Array.isArray(parsedData.records)) {
            logger.info(
                `The records field of the fetched ${filename}.json is not an array`
            );
            return await interaction.editReply(
                `:x: The records field of the fetched ${filename}.json is not an array`
            );
        }

        const newRecord = JSON.parse(githubCode);

        // {fileRecord} is the record we're looping through, and
        // {record} is the current record we're trying to commit

        let existing = false;
        let updated = false;
        // If duplicate, don't add it to githubCodes
        for (const fileRecord of parsedData.records) {
            if (fileRecord.user === user.name) {
                logger.info(
                    `Found existing record of ${filename} for ${user.name}`
                );
                if (fileRecord.percent < (newPercent ?? 0)) {
                    logger.info(
                        "This record has a greater percent on this level, updating..."
                    );
                    fileRecord.percent = newPercent ?? 0;
                    fileRecord.enjoyment = newEnjoyment ?? undefined;
                    fileRecord.link = oldRecord.completionlink ?? "";
                    updated = true;
                } else {
                    logger.info(
                        `Canceled adding duplicated record of ${filename} for ${user.name}`
                    );
                    // todo: what the flip
                    // await db.acceptedRecord.deleteMany({ where: { id: record.id } });
                    existing = true;
                }
            }
        }

        // if the record does not already exist or existed but has been updated
        if (existing === true && updated === false) {
            return await interaction.editReply(
                `:x: This user already has a record on this level!`
            );
        }

        await interaction.editReply("Writing record to DB...");
        let record;
        try {
            const recordEntry = await db.acceptedRecord.create({
                data: {
                    username: oldRecord.username,
                    submitter: interaction.user.id, // always equal to moderator
                    levelname: level.name,
                    filename: level.filename,
                    device: newDevice,
                    completionlink: oldRecord.completionlink,
                    enjoyment: newEnjoyment,
                    fps: newFPS,
                    percent: newPercent,
                    raw: oldRecord.raw,
                    ldm: oldRecord.ldm, // always 0
                    additionalnotes: newNotes,
                    priority: oldRecord.priority, // always false
                    modMenu: newModMenu,
                    moderator: interaction.user.id // always equal to submitter
                }
            });

            record = recordEntry;
        } catch (e) {
            logger.log(`Error while adding the record to the database: ${e}`);
            return await interaction.editReply(
                `:x: Error while adding the record to the database: ${e}`
            );
        }

        await interaction.editReply("Committing...");
        // Add new record to the level's file if this is a new record (not an updated one)
        if (updated === false)
            parsedData.records = parsedData.records.concat(newRecord);

        const changes = [];
        changes.push({
            path: githubDataPath + `/${filename}.json`,
            content: JSON.stringify(parsedData, null, "\t")
        });

        const changePath = githubDataPath + `/${filename}.json`;
        const content = JSON.stringify(parsedData);

        const debugStatus = await db.info.findFirst({
            where: { name: "commitdebug" }
        });
        if (!debugStatus || !debugStatus.status) {
            let commitSha;
            try {
                // Get the SHA of the latest commit from the branch
                const { data: refData } = await octokit.git.getRef({
                    owner: githubOwner,
                    repo: githubRepo,
                    ref: `heads/${githubBranch}`
                });
                commitSha = refData.object.sha;
            } catch (getRefError) {
                logger.info(
                    `Something went wrong while fetching the latest commit SHA:\n${getRefError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (getRefError)"
                );
            }
            let treeSha;
            try {
                // Get the commit using its SHA
                const { data: commitData } = await octokit.git.getCommit({
                    owner: githubOwner,
                    repo: githubRepo,
                    commit_sha: commitSha
                });
                treeSha = commitData.tree.sha;
            } catch (getCommitError) {
                logger.info(
                    `Something went wrong while fetching the latest commit:\n${getCommitError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (getCommitError)"
                );
            }

            let newTree;
            try {
                // Create a new tree with the changes
                newTree = await octokit.git.createTree({
                    owner: githubOwner,
                    repo: githubRepo,
                    base_tree: treeSha,
                    tree: changes.map((change) => ({
                        path: change.path,
                        mode: "100644",
                        type: "blob",
                        content: change.content
                    }))
                });
            } catch (createTreeError) {
                logger.info(
                    `Something went wrong while creating a new tree:\n${createTreeError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (createTreeError)"
                );
            }

            let newCommit;
            try {
                // Create a new commit with this tree
                newCommit = await octokit.git.createCommit({
                    owner: githubOwner,
                    repo: githubRepo,
                    message: `Added ${record.username}'s record to ${filename} (${interaction.user.tag})`,
                    tree: newTree.data.sha,
                    parents: [commitSha]
                });
            } catch (createCommitError) {
                logger.info(
                    `Something went wrong while creating a new commit:\n${createCommitError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (createCommitError)"
                );
            }

            try {
                // Update the branch to point to the new commit
                await octokit.git.updateRef({
                    owner: githubOwner,
                    repo: githubRepo,
                    ref: `heads/${githubBranch}`,
                    sha: newCommit.data.sha
                });
            } catch (updateRefError) {
                logger.info(
                    `Something went wrong while updating the branch :\n${updateRefError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (updateRefError)"
                );
            }
            logger.info(
                `Successfully created commit on ${githubBranch} (record addition): ${newCommit.data.sha}`
            );
        } else {
            // Get file SHA
            let fileSha;
            try {
                const response = await octokit.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: changePath
                });
                fileSha = asFile(response.data).sha;
            } catch (error) {
                logger.info(`Error fetching ${changePath} SHA:\n${error}`);
                return await interaction.editReply(
                    `:x: Couldn't fetch data from ${changePath}`
                );
            }

            try {
                await octokit.repos.createOrUpdateFileContents({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: changePath,
                    message: `Updated ${changePath} (${interaction.user.tag})`,
                    content: Buffer.from(content).toString("base64"),
                    sha: fileSha
                });
                logger.info(`Updated ${changePath} (${interaction.user.tag}`);
            } catch (error) {
                logger.info(
                    `Failed to update ${changePath} (${interaction.user.tag}):\n${error}`
                );
                await interaction.editReply(
                    `:x: Couldn't update the file ${changePath}, skipping...`
                );
            }
        }

        // Send all messages simultaneously
        const guild = await interaction.client.guilds.fetch(guildId);

        // staffGuild.channels.cache.get(acceptedRecordsID).send({ content: '', embeds: [acceptEmbed], components: [row] });
        getTextChannel(guild, archiveRecordsID).send({ embeds: [publicEmbed] });

        // Check if we need to send in dms as well
        const settings = await db.settings.findFirst({
            where: { moderator: interaction.user.id }
        });
        if (!settings) {
            await db.settings.create({
                data: {
                    moderator: interaction.user.id,
                    sendAcceptedInDM: false
                }
            });
        } else if (settings.sendAcceptedInDM) {
            try {
                const notRawGithubCode: Record<string, unknown> = {
                    user: record.username,
                    link: record.completionlink,
                    percent: record.percent,
                    hz: record.fps,
                    ...(record.device === "Mobile" && { mobile: true })
                };

                if (record.enjoyment !== null && record.enjoyment !== undefined)
                    notRawGithubCode.enjoyment = record.enjoyment;

                const rawGithubCode = JSON.stringify(
                    notRawGithubCode,
                    null,
                    "\t"
                );

                const dmMessage = `Added record of ${record.levelname} for ${record.username}\nGithub Code:\n\`\`\`${rawGithubCode}\`\`\``;
                await interaction.user.send({ content: dmMessage });
            } catch {
                logger.info(
                    `Failed to send in moderator ${interaction.user.id} dms, ignoring send in dms setting`
                );
            }
        }

        // Update moderator data (create new entry if that moderator hasn't accepted/denied records before)
        const modInfo = await db.staff.findFirst({
            where: { moderator: interaction.user.id }
        });
        if (!modInfo) {
            await db.staff.create({
                data: {
                    moderator: interaction.user.id,
                    nbRecords: 1,
                    nbDenied: 0,
                    nbAccepted: 1
                }
            });
        } else {
            await db.staff.update({
                where: { id: modInfo.id },
                data: { nbRecords: { increment: 1 } }
            });
            await db.staff.update({
                where: { id: modInfo.id },
                data: { nbAccepted: { increment: 1 } }
            });
        }

        await incrementDailyStat("nbRecordsAccepted");
        logger.info(
            `${interaction.user.tag} (${interaction.user.id}) submitted ${record.levelname} for ${record.username}`
        );
        return await interaction.editReply(
            enablePriorityRole &&
                interaction.member.roles.cache.has(priorityRoleID)
                ? `:white_check_mark: The priority record for ${record.levelname} has been submitted successfully`
                : `:white_check_mark: The record for ${level.name} has been added successfully`
        );
    } else if (interaction.options.getSubcommand() === "stats") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        // Shows mod stats

        const modId = interaction.user.id;

        const modInfo = await db.staff.findFirst({
            where: { moderator: modId }
        });

        if (!modInfo) {
            return await interaction.editReply(
                ":x: You haven't accepted or denied any record yet"
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
            width: 800,
            height: 300,
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
    } else if (interaction.options.getSubcommand() === "modleaderboard") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        // Display staff records leaderboard //

        // Get number of staff
        const nbTotal = await db.staff.count();
        // Get sqlite data, ordered by descending number of records, limited to top 20 for now (maybe add a page system later)
        const modInfos = await db.staff.findMany({
            take: 30,
            orderBy: { nbRecords: "desc" },
            select: {
                moderator: true,
                nbRecords: true,
                nbAccepted: true,
                nbDenied: true,
                updatedAt: true
            }
        });
        if (!nbTotal || !modInfos)
            return await interaction.editReply(
                ":x: Something went wrong while executing the command"
            );

        let strModData = "";
        for (let i = 0; i < modInfos.length; i++) {
            strModData += `**${i + 1}** - <@${modInfos[i].moderator}> - ${
                modInfos[i].nbRecords
            } records (${modInfos[i].nbAccepted} A, ${
                modInfos[i].nbDenied
            } D) - Last activity : ${modInfos[i].updatedAt.toDateString()}\n`;
        }

        // Embed displaying the data
        const modEmbed = new EmbedBuilder()
            .setColor(0xffbf00)
            .setAuthor({ name: "Moderator leaderboard" })
            .setDescription(strModData)
            .setTimestamp();

        // Send reply
        return await interaction.editReply({ embeds: [modEmbed] });
    } else if (interaction.options.getSubcommand() === "recordsinfo") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Check submissions info //
        const submissionsType = interaction.options.getString("type", true);

        const selectedTable =
            submissionsType === "pending"
                ? "pendingRecords"
                : submissionsType === "accepted"
                  ? "acceptedRecords"
                  : "deniedRecords";
        let strInfo = `Total records : ${await db.pendingRecord.count()} pending, ${await db.acceptedRecord.count()} accepted, ${await db.deniedRecord.count()} denied\n\n`;
        const users = await topSubmitters(selectedTable, 30);
        for (let i = 0; i < users.length; i++) {
            const pendingCount = await db.pendingRecord.count({
                where: { submitter: users[i].submitter }
            });
            const acceptedCount = await db.acceptedRecord.count({
                where: { submitter: users[i].submitter }
            });
            const deniedCount = await db.deniedRecord.count({
                where: { submitter: users[i].submitter }
            });
            const submittedCount = pendingCount + acceptedCount + deniedCount;
            strInfo += `**${i + 1}** - <@${
                users[i].submitter
            }> - ${pendingCount} pending - (${submittedCount} submitted, ${acceptedCount} accepted, ${deniedCount} denied)\n`;
        }
        if (users.length > 30) strInfo += "...";

        const infoEmbed = new EmbedBuilder()
            .setColor(0xffbf00)
            .setTitle(`Currently ${submissionsType} records users stats`)
            .setDescription(strInfo)
            .setTimestamp();

        return await interaction.editReply({ embeds: [infoEmbed] });
    } else if (interaction.options.getSubcommand() === "enabledm") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Update sqlite db
        const update = await db.settings.updateMany({
            where: { moderator: interaction.user.id },
            data: {
                sendAcceptedInDM:
                    interaction.options.getString("status", true) === "enabled"
            }
        });

        if (update.count === 0) {
            const create = await db.settings.create({
                data: {
                    moderator: interaction.user.id,
                    sendAcceptedInDM:
                        interaction.options.getString("status", true) ===
                        "enabled"
                }
            });

            if (!create)
                return await interaction.editReply(
                    ":x: Something went wrong while executing the command"
                );
        }
        return await interaction.editReply(
            `:white_check_mark: Changed setting to ${interaction.options.getString("status", true)}`
        );
    } else if (interaction.options.getSubcommand() === "commit") {
        await interaction.deferReply();

        await db.recordToCommit.updateMany({
            where: {},
            data: { discordid: interaction.id }
        });

        if (
            (await db.recordToCommit.count({
                where: { discordid: interaction.id }
            })) == 0
        )
            return await interaction.editReply(
                ":x: There are no pending accepted record to be commited"
            );
        const commitEmbed = new EmbedBuilder()
            .setColor(0x8fce00)
            .setTitle("Commiting records")
            .addFields(
                {
                    name: "Number of records:",
                    value: `${await db.recordToCommit.count({
                        where: { discordid: interaction.id }
                    })}`,
                    inline: true
                },
                {
                    name: "Affected files:",
                    value: `${
                        (
                            await db.recordToCommit.findMany({
                                where: { discordid: interaction.id },
                                distinct: ["filename"]
                            })
                        ).length
                    }`,
                    inline: true
                }
            )
            .setTimestamp();
        // Create commit buttons
        const commit = new ButtonBuilder()
            .setCustomId("commitRecords")
            .setLabel("Commit changes")
            .setStyle(ButtonStyle.Success);

        const cancel = new ButtonBuilder()
            .setCustomId("removeMsg")
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(commit)
            .addComponents(cancel);

        await interaction.editReply({
            embeds: [commitEmbed],
            components: [row]
        });
        const sent = await interaction.fetchReply();
        await db.recordToCommit.updateMany({
            where: { discordid: interaction.id },
            data: { discordid: sent.id }
        });
    } else if (interaction.options.getSubcommand() === "commitdebug") {
        // Changes debug status

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Update sqlite db
        const update = await db.info.updateMany({
            where: { name: "commitdebug" },
            data: {
                status:
                    interaction.options.getString("status", true) === "enabled"
            }
        });
        if (update.count === 0)
            return await interaction.editReply(
                ":x: Something went wrong while executing the command"
            );
        logger.info(
            `Changed debug status to ${interaction.options.getString("status", true)}`
        );
        return await interaction.editReply(
            `:white_check_mark: Changed debug status to ${interaction.options.getString("status", true)}`
        );
    } else if (interaction.options.getSubcommand() === "commitreset") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        await db.recordToCommit.deleteMany({ where: {} });
        if ((await db.recordToCommit.count()) == 0)
            return await interaction.editReply(
                ":white_check_mark: The list was successfully reset"
            );
        else
            return await interaction.editReply(
                ":x: Something went wrong while removing records"
            );
    } else if (interaction.options.getSubcommand() === "delete") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const level = await db.cachedLevel.findFirst({
            where: {
                filename: interaction.options.getString("levelname", true)
            }
        });
        const username = interaction.options.getString("username", true);

        if (!level)
            return await interaction.editReply(":x: Couldn't find the level");
        const filename = level.filename;

        let fileResponse;
        try {
            fileResponse = await octokit.rest.repos.getContent({
                owner: githubOwner,
                repo: githubRepo,
                path: githubDataPath + `/${filename}.json`,
                branch: githubBranch
            });
        } catch (fetchError) {
            logger.info(`Couldn't fetch ${filename}.json: \n${fetchError}`);
            return await interaction.editReply(
                `:x: Couldn't fetch ${filename}.json: \n${fetchError}`
            );
        }

        let parsedData: ListLevel;
        try {
            parsedData = JSON.parse(
                Buffer.from(
                    asFile(fileResponse.data).content,
                    "base64"
                ).toString("utf-8")
            );
        } catch (parseError) {
            logger.info(
                `Unable to parse data fetched from ${filename}:\n${parseError}`
            );
            return await interaction.editReply(
                `:x: Unable to parse data fetched from ${filename}:\n${parseError}`
            );
        }
        if (!Array.isArray(parsedData.records)) {
            logger.info(
                `The records field of the fetched ${filename}.json is not an array`
            );
            return await interaction.editReply(
                `:x: The records field of the fetched ${filename}.json is not an array`
            );
        }

        const recordIndex = parsedData.records.findIndex(
            (record) => record.user === username
        );
        if (recordIndex === -1)
            return await interaction.editReply(
                `:x: Couldn't find a record with the username \`${username}\``
            );

        parsedData.records.splice(recordIndex, 1);

        await interaction.editReply("Committing...");

        // not sure why it needs to be done this way but :shrug:
        const changes = [];
        changes.push({
            path: githubDataPath + `/${filename}.json`,
            content: JSON.stringify(parsedData, null, "\t")
        });

        const changePath = githubDataPath + `/${filename}.json`;
        const content = JSON.stringify(parsedData);

        const debugStatus = await db.info.findFirst({
            where: { name: "commitdebug" }
        });
        if (!debugStatus || !debugStatus.status) {
            let commitSha;
            try {
                // Get the SHA of the latest commit from the branch
                const { data: refData } = await octokit.git.getRef({
                    owner: githubOwner,
                    repo: githubRepo,
                    ref: `heads/${githubBranch}`
                });
                commitSha = refData.object.sha;
            } catch (getRefError) {
                logger.info(
                    `Something went wrong while fetching the latest commit SHA:\n${getRefError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (getRefError)"
                );
            }
            let treeSha;
            try {
                // Get the commit using its SHA
                const { data: commitData } = await octokit.git.getCommit({
                    owner: githubOwner,
                    repo: githubRepo,
                    commit_sha: commitSha
                });
                treeSha = commitData.tree.sha;
            } catch (getCommitError) {
                logger.info(
                    `Something went wrong while fetching the latest commit:\n${getCommitError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (getCommitError)"
                );
            }

            let newTree;
            try {
                // Create a new tree with the changes
                newTree = await octokit.git.createTree({
                    owner: githubOwner,
                    repo: githubRepo,
                    base_tree: treeSha,
                    tree: changes.map((change) => ({
                        path: change.path,
                        mode: "100644",
                        type: "blob",
                        content: change.content
                    }))
                });
            } catch (createTreeError) {
                logger.info(
                    `Something went wrong while creating a new tree:\n${createTreeError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (createTreeError)"
                );
            }

            let newCommit;
            try {
                // Create a new commit with this tree
                newCommit = await octokit.git.createCommit({
                    owner: githubOwner,
                    repo: githubRepo,
                    message: `Removed ${username}'s record from ${filename}.json (${interaction.user.tag})`,
                    tree: newTree.data.sha,
                    parents: [commitSha]
                });
            } catch (createCommitError) {
                logger.info(
                    `Something went wrong while creating a new commit:\n${createCommitError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (createCommitError)"
                );
            }

            try {
                // Update the branch to point to the new commit
                await octokit.git.updateRef({
                    owner: githubOwner,
                    repo: githubRepo,
                    ref: `heads/${githubBranch}`,
                    sha: newCommit.data.sha
                });
            } catch (updateRefError) {
                logger.info(
                    `Something went wrong while updating the branch :\n${updateRefError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (updateRefError)"
                );
            }
            logger.info(
                `Successfully created commit on ${githubBranch} (record addition): ${newCommit.data.sha}`
            );
            await interaction.editReply("This record has been removed!");
        } else {
            // Get file SHA
            let fileSha;
            try {
                const response = await octokit.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: changePath
                });
                fileSha = asFile(response.data).sha;
            } catch (error) {
                logger.info(`Error fetching ${changePath} SHA:\n${error}`);
                return await interaction.editReply(
                    `:x: Couldn't fetch data from ${changePath}`
                );
            }

            try {
                await octokit.repos.createOrUpdateFileContents({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: changePath,
                    message: `Updated ${changePath} (${interaction.user.tag})`,
                    content: Buffer.from(content).toString("base64"),
                    sha: fileSha
                });
                logger.info(`Updated ${changePath} (${interaction.user.tag}`);
            } catch (error) {
                logger.info(
                    `Failed to update ${changePath} (${interaction.user.tag}):\n${error}`
                );
                await interaction.editReply(
                    `:x: Couldn't update the file ${changePath}, skipping...`
                );
            }
        }
    } else if (interaction.options.getSubcommand() === "edit") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const levelname = interaction.options.getString("levelname", true);
        const olduser = interaction.options.getString("username", true);

        const level = await db.cachedLevel.findFirst({
            where: { filename: levelname }
        });

        if (!level)
            return await interaction.editReply(":x: Couldn't find the level");
        const filename = level.filename;

        let fileResponse;
        try {
            fileResponse = await octokit.rest.repos.getContent({
                owner: githubOwner,
                repo: githubRepo,
                path: githubDataPath + `/${filename}.json`,
                branch: githubBranch
            });
        } catch (fetchError) {
            logger.info(`Couldn't fetch ${filename}.json: \n${fetchError}`);
            return await interaction.editReply(
                `:x: Couldn't fetch ${filename}.json: \n${fetchError}`
            );
        }

        let parsedData: ListLevel;
        try {
            parsedData = JSON.parse(
                Buffer.from(
                    asFile(fileResponse.data).content,
                    "base64"
                ).toString("utf-8")
            );
        } catch (parseError) {
            logger.info(
                `Unable to parse data fetched from ${filename}:\n${parseError}`
            );
            return await interaction.editReply(
                `:x: Unable to parse data fetched from ${filename}:\n${parseError}`
            );
        }
        if (!Array.isArray(parsedData.records)) {
            logger.info(
                `The records field of the fetched ${filename}.json is not an array`
            );
            return await interaction.editReply(
                `:x: The records field of the fetched ${filename}.json is not an array`
            );
        }

        const recordIndex = parsedData.records.findIndex(
            (record) => record.user.toLowerCase() === olduser.toLowerCase()
        );
        if (recordIndex === -1)
            return await interaction.editReply(
                `:x: Couldn't find a record with the username \`${olduser}\``
            );

        const newuser = interaction.options.getString("newuser") || null;
        const fps = interaction.options.getInteger("fps") || null;
        const percent = interaction.options.getInteger("percent") || null;
        const enjoyment = interaction.options.getInteger("enjoyment") ?? null;
        const video = interaction.options.getString("completionlink") || null;
        const device = interaction.options.getString("device") || null;

        if (newuser !== null) parsedData.records[recordIndex].user = newuser;
        if (fps !== null) parsedData.records[recordIndex].hz = fps;
        if (percent !== null) parsedData.records[recordIndex].percent = percent;
        if (enjoyment !== null)
            parsedData.records[recordIndex].enjoyment = enjoyment;
        if (video !== null) parsedData.records[recordIndex].link = video;
        if (device !== null) {
            if (device === "Mobile") {
                parsedData.records[recordIndex].mobile = true;
            } else {
                delete parsedData.records[recordIndex].mobile;
            }
        }

        await interaction.editReply("Committing...");

        // not sure why it needs to be done this way but :shrug:
        const changes = [];
        changes.push({
            path: githubDataPath + `/${filename}.json`,
            content: JSON.stringify(parsedData, null, "\t")
        });

        let commitSha;
        try {
            // Get the SHA of the latest commit from the branch
            const { data: refData } = await octokit.git.getRef({
                owner: githubOwner,
                repo: githubRepo,
                ref: `heads/${githubBranch}`
            });
            commitSha = refData.object.sha;
        } catch (getRefError) {
            logger.info(
                `Something went wrong while fetching the latest commit SHA:\n${getRefError}`
            );
            return await interaction.editReply(
                ":x: Something went wrong while commiting the records to github, please try again later (getRefError)"
            );
        }
        let treeSha;
        try {
            // Get the commit using its SHA
            const { data: commitData } = await octokit.git.getCommit({
                owner: githubOwner,
                repo: githubRepo,
                commit_sha: commitSha
            });
            treeSha = commitData.tree.sha;
        } catch (getCommitError) {
            logger.info(
                `Something went wrong while fetching the latest commit:\n${getCommitError}`
            );
            return await interaction.editReply(
                ":x: Something went wrong while commiting the records to github, please try again later (getCommitError)"
            );
        }

        let newTree;
        try {
            // Create a new tree with the changes
            newTree = await octokit.git.createTree({
                owner: githubOwner,
                repo: githubRepo,
                base_tree: treeSha,
                tree: changes.map((change) => ({
                    path: change.path,
                    mode: "100644",
                    type: "blob",
                    content: change.content
                }))
            });
        } catch (createTreeError) {
            logger.info(
                `Something went wrong while creating a new tree:\n${createTreeError}`
            );
            return await interaction.editReply(
                ":x: Something went wrong while commiting the records to github, please try again later (createTreeError)"
            );
        }

        let newCommit;
        try {
            // Create a new commit with this tree
            newCommit = await octokit.git.createCommit({
                owner: githubOwner,
                repo: githubRepo,
                message: `Updated ${olduser}'s record on ${levelname} (${interaction.user.tag})`,
                tree: newTree.data.sha,
                parents: [commitSha]
            });
        } catch (createCommitError) {
            logger.info(
                `Something went wrong while creating a new commit:\n${createCommitError}`
            );
            return await interaction.editReply(
                ":x: Something went wrong while commiting the records to github, please try again later (createCommitError)"
            );
        }

        try {
            // Update the branch to point to the new commit
            await octokit.git.updateRef({
                owner: githubOwner,
                repo: githubRepo,
                ref: `heads/${githubBranch}`,
                sha: newCommit.data.sha
            });
        } catch (updateRefError) {
            logger.info(
                `Something went wrong while updating the branch :\n${updateRefError}`
            );
            return await interaction.editReply(
                ":x: Something went wrong while commiting the records to github, please try again later (updateRefError)"
            );
        }
        logger.info(
            `Successfully created commit on ${githubBranch} (record update): ${newCommit.data.sha}`
        );
        return await interaction.editReply(
            ":white_check_mark: This record has been updated!"
        );
    } else if (interaction.options.getSubcommand() === "updatedata") {
        await cache.updateLevels();
        await cache.updatePacks();
        await cache.updateUsers();
        return await interaction.reply(
            ":white_check_mark: Data has been updated"
        );
    } else if (interaction.options.getSubcommand() === "shift") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const level = await db.cachedLevel.findFirst({
            where: {
                filename: interaction.options.getString("levelname", true)
            }
        });
        const username = interaction.options.getString("username", true);
        let offset = interaction.options.getInteger("offset", true);

        offset = offset * -1;

        if (!level)
            return await interaction.editReply(":x: Couldn't find the level");
        const filename = level.filename;

        let fileResponse;
        try {
            fileResponse = await octokit.rest.repos.getContent({
                owner: githubOwner,
                repo: githubRepo,
                path: githubDataPath + `/${filename}.json`,
                branch: githubBranch
            });
        } catch (fetchError) {
            logger.info(`Couldn't fetch ${filename}.json: \n${fetchError}`);
            return await interaction.editReply(
                `:x: Couldn't fetch ${filename}.json: \n${fetchError}`
            );
        }

        let parsedData: ListLevel;
        try {
            parsedData = JSON.parse(
                Buffer.from(
                    asFile(fileResponse.data).content,
                    "base64"
                ).toString("utf-8")
            );
        } catch (parseError) {
            logger.info(
                `Unable to parse data fetched from ${filename}:\n${parseError}`
            );
            return await interaction.editReply(
                `:x: Unable to parse data fetched from ${filename}:\n${parseError}`
            );
        }
        if (!Array.isArray(parsedData.records)) {
            logger.info(
                `The records field of the fetched ${filename}.json is not an array`
            );
            return await interaction.editReply(
                `:x: The records field of the fetched ${filename}.json is not an array`
            );
        }

        const recordIndex = parsedData.records.findIndex(
            (record) => record.user === username
        );
        if (recordIndex === -1)
            return await interaction.editReply(
                `:x: Couldn't find a record with the username \`${username}\``
            );

        const newPos = recordIndex + offset;
        if (newPos < 0 || newPos >= parsedData.records.length)
            return await interaction.editReply(
                `:x: The new position is out of bounds`
            );

        const record = parsedData.records.splice(recordIndex, 1)[0];
        parsedData.records.splice(newPos, 0, record);

        await interaction.editReply("Committing...");

        // not sure why it needs to be done this way but :shrug:
        const changes = [];
        changes.push({
            path: githubDataPath + `/${filename}.json`,
            content: JSON.stringify(parsedData, null, "\t")
        });

        const changePath = githubDataPath + `/${filename}.json`;
        const content = JSON.stringify(parsedData);

        const debugStatus = await db.info.findFirst({
            where: { name: "commitdebug" }
        });
        if (!debugStatus || !debugStatus.status) {
            let commitSha;
            try {
                // Get the SHA of the latest commit from the branch
                const { data: refData } = await octokit.git.getRef({
                    owner: githubOwner,
                    repo: githubRepo,
                    ref: `heads/${githubBranch}`
                });
                commitSha = refData.object.sha;
            } catch (getRefError) {
                logger.info(
                    `Something went wrong while fetching the latest commit SHA:\n${getRefError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (getRefError)"
                );
            }
            let treeSha;
            try {
                // Get the commit using its SHA
                const { data: commitData } = await octokit.git.getCommit({
                    owner: githubOwner,
                    repo: githubRepo,
                    commit_sha: commitSha
                });
                treeSha = commitData.tree.sha;
            } catch (getCommitError) {
                logger.info(
                    `Something went wrong while fetching the latest commit:\n${getCommitError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (getCommitError)"
                );
            }

            let newTree;
            try {
                // Create a new tree with the changes
                newTree = await octokit.git.createTree({
                    owner: githubOwner,
                    repo: githubRepo,
                    base_tree: treeSha,
                    tree: changes.map((change) => ({
                        path: change.path,
                        mode: "100644",
                        type: "blob",
                        content: change.content
                    }))
                });
            } catch (createTreeError) {
                logger.info(
                    `Something went wrong while creating a new tree:\n${createTreeError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (createTreeError)"
                );
            }

            let newCommit;
            try {
                // Create a new commit with this tree
                newCommit = await octokit.git.createCommit({
                    owner: githubOwner,
                    repo: githubRepo,
                    message: `Reordered ${username}'s record on ${filename}.json (${interaction.user.tag})`,
                    tree: newTree.data.sha,
                    parents: [commitSha]
                });
            } catch (createCommitError) {
                logger.info(
                    `Something went wrong while creating a new commit:\n${createCommitError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (createCommitError)"
                );
            }

            try {
                // Update the branch to point to the new commit
                await octokit.git.updateRef({
                    owner: githubOwner,
                    repo: githubRepo,
                    ref: `heads/${githubBranch}`,
                    sha: newCommit.data.sha
                });
            } catch (updateRefError) {
                logger.info(
                    `Something went wrong while updating the branch :\n${updateRefError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (updateRefError)"
                );
            }
            logger.info(
                `Successfully created commit on ${githubBranch} (record addition): ${newCommit.data.sha}`
            );
            await interaction.editReply(
                ":white_check_mark: The record has been moved!"
            );
        } else {
            // Get file SHA
            let fileSha;
            try {
                const response = await octokit.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: changePath
                });
                fileSha = asFile(response.data).sha;
            } catch (error) {
                logger.info(`Error fetching ${changePath} SHA:\n${error}`);
                return await interaction.editReply(
                    `:x: Couldn't fetch data from ${changePath}`
                );
            }

            try {
                await octokit.repos.createOrUpdateFileContents({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: changePath,
                    message: `Updated ${changePath} (${interaction.user.tag})`,
                    content: Buffer.from(content).toString("base64"),
                    sha: fileSha
                });
                logger.info(`Updated ${changePath} (${interaction.user.tag}`);
            } catch (error) {
                logger.info(
                    `Failed to update ${changePath} (${interaction.user.tag}):\n${error}`
                );
                await interaction.editReply(
                    `:x: Couldn't update the file ${changePath}, skipping...`
                );
            }
        }
    } else if (interaction.options.getSubcommand() === "ban") {
        await interaction.deferReply();
        await cloneOrPullRepo();

        const username = interaction.options.getString("username", true);
        const listFilename = "data/_list.json";
        let list_data;
        try {
            list_data = JSON.parse(
                fs.readFileSync(path.join(localRepoPath, listFilename), "utf8")
            );
        } catch (parseError) {
            if (!listFilename.startsWith("_"))
                logger.error(
                    "Git - " +
                        `Unable to parse data from ${listFilename}:\n${parseError}`
                );
            return -1;
        }

        const changes = [];

        for (const filename of list_data) {
            let parsedData: ListLevel;
            try {
                parsedData = JSON.parse(
                    fs.readFileSync(
                        path.join(localRepoPath, `data/${filename}.json`),
                        "utf8"
                    )
                );
            } catch (parseError) {
                if (!filename.startsWith("_"))
                    logger.error(
                        "Git - " +
                            `Unable to parse data from ${filename}.json:\n${parseError}`
                    );
                continue;
            }
            if (!Array.isArray(parsedData.records)) {
                continue;
            }

            const recordIndex = parsedData.records.findIndex(
                (record) => record.user === username
            );

            if (recordIndex === -1) continue;

            parsedData.records.splice(recordIndex, 1);

            changes.push({
                path: `${githubDataPath}/${filename}.json`,
                content: JSON.stringify(parsedData, null, "\t")
            });
        }

        await interaction.editReply("Committing...");

        let commitSha;
        try {
            // Get the SHA of the latest commit from the branch
            const { data: refData } = await octokit.git.getRef({
                owner: githubOwner,
                repo: githubRepo,
                ref: `heads/${githubBranch}`
            });
            commitSha = refData.object.sha;
        } catch (getRefError) {
            logger.info(
                `Something went wrong while fetching the latest commit SHA:\n${getRefError}`
            );
            return await interaction.editReply(
                ":x: Something went wrong while commiting to github, please try again later (getRefError)"
            );
        }
        let treeSha;
        try {
            // Get the commit using its SHA
            const { data: commitData } = await octokit.git.getCommit({
                owner: githubOwner,
                repo: githubRepo,
                commit_sha: commitSha
            });
            treeSha = commitData.tree.sha;
        } catch (getCommitError) {
            logger.info(
                `Something went wrong while fetching the latest commit:\n${getCommitError}`
            );
            return await interaction.editReply(
                ":x: Something went wrong while commiting to github, please try again later (getCommitError)"
            );
        }

        let newTree;
        try {
            // Create a new tree with the changes
            newTree = await octokit.git.createTree({
                owner: githubOwner,
                repo: githubRepo,
                base_tree: treeSha,
                tree: changes.map((change) => ({
                    path: change.path,
                    mode: "100644",
                    type: "blob",
                    content: change.content
                }))
            });
        } catch (createTreeError) {
            logger.info(
                `Something went wrong while creating a new tree:\n${createTreeError}`
            );
            return await interaction.editReply(
                ":x: Something went wrong while commiting to github, please try again later (createTreeError)"
            );
        }

        let newCommit;
        try {
            // Create a new commit with this tree
            newCommit = await octokit.git.createCommit({
                owner: githubOwner,
                repo: githubRepo,
                message: `Banned ${username} from the list (${interaction.user.tag})`,
                tree: newTree.data.sha,
                parents: [commitSha]
            });
        } catch (createCommitError) {
            logger.info(
                `Something went wrong while creating a new commit:\n${createCommitError}`
            );
            return await interaction.editReply(
                ":x: Something went wrong while commiting to github, please try again later (createCommitError)"
            );
        }

        try {
            // Update the branch to point to the new commit
            await octokit.git.updateRef({
                owner: githubOwner,
                repo: githubRepo,
                ref: `heads/${githubBranch}`,
                sha: newCommit.data.sha
            });
        } catch (updateRefError) {
            logger.info(
                `Something went wrong while updating the branch :\n${updateRefError}`
            );
            return await interaction.editReply(
                ":x: Something went wrong while commiting to github, please try again later (updateRefError)"
            );
        }
        logger.info(
            `Successfully created commit on ${githubBranch} (record addition): ${newCommit.data.sha}`
        );

        await interaction.editReply(`Banned ${username}!`);
    } else if (interaction.options.getSubcommand() === "deny") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const username = interaction.options.getString("username", true);
        const filename = interaction.options.getString("levelname", true);
        const reason = interaction.options.getString("reason", true);
        const discord = interaction.options.getUser("user");

        const levelname = (
            await db.cachedLevel.findFirst({
                where: { filename: filename },
                select: { name: true }
            })
        )?.name;

        const recordsChannel = interaction.client.guilds.cache
            .get(guildId)
            ?.channels.cache.get(archiveRecordsID);
        if (!recordsChannel?.isTextBased()) {
            return await interaction.editReply(
                ":x: Records channel not found."
            );
        }

        await recordsChannel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle(`:x: ${levelname}`)
                    .addFields(
                        { name: "Record holder", value: username },
                        { name: "Reason", value: reason }
                    )
            ],
            content: discord ? `${discord}` : undefined
        });

        await incrementProgress(interaction.user.id, 1);

        return await interaction.editReply(`:white_check_mark: Denied record!`);
    }
};
