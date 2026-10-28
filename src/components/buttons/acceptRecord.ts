import type { ListLevel } from "../../lib/listTypes";
import { findTextChannel, getTextChannel } from "../../lib/discord";
import {
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder
} from "discord.js";
import { logger } from "../../lib/logger";
import { config } from "../../lib/config";
import { db, incrementDailyStat } from "../../lib/db";
import { octokit, asFile } from "../../lib/github";
import type { ButtonHandler } from "../types";

const {
    archiveRecordsID,
    acceptedRecordsID,
    recordsID,
    guildId,
    githubOwner,
    githubRepo,
    githubDataPath,
    githubBranch
} = config;

export default {
    customId: "accept",
    ephemeral: true,
    async execute(interaction) {
        // Accepting a record //

        // Check for record info corresponding to the message id
        const record = await db.pendingRecord.findFirst({
            where: { discordid: interaction.message.id }
        });
        if (!record) {
            await interaction.editReply(
                ":x: Couldn't find a record linked to that discord message ID"
            );
            try {
                await interaction.message.delete();
            } catch (error) {
                logger.info(error);
            }
            return;
        }

        // Get cached user
        const user = await db.cachedUser.findFirst({
            where: { name: record.username ?? "" }
        });
        if (!user)
            return await interaction.editReply(
                ":x: Couldn't find the user this record was submitted for (their name might have changed since they submitted it)"
            );

        // Create embed to send with github code
        const githubCode =
            `{\n\t\t"user": "${user.name}",\n\t\t"link": "${record.completionlink}",\n\t\t"percent": ${record.percent},\n\t\t"hz": ${record.fps}` +
            (record.enjoyment !== -1
                ? `,\n\t\t"enjoyment": ${record.enjoyment}`
                : "") +
            (record.device == "Mobile" ? ',\n\t\t"mobile": true\n}\n' : "\n}");

        const level = await db.cachedLevel.findFirst({
            where: { name: record.levelname ?? "" }
        });
        if (!level)
            return await interaction.editReply(
                ":x: Couldn't find the level this record was submitted for (it might have been deleted)"
            );

        const acceptEmbed = new EmbedBuilder()
            .setColor(0x8fce00)
            .setTitle(`:white_check_mark: ${record.levelname}`)
            .addFields(
                {
                    name: "Record accepted by",
                    value: `${interaction.user}`,
                    inline: true
                },
                {
                    name: "Record holder",
                    value: `${record.username}`,
                    inline: true
                },
                {
                    name: "Github code",
                    value: `\`\`\`json\n${githubCode}\n\`\`\``
                }
            )
            .setTimestamp()
            .setFooter({ text: `Added to the commit list` });

        // Create button to remove the message
        const remove = new ButtonBuilder()
            .setCustomId("removeMsg")
            .setLabel("Delete message")
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(remove);

        // Remove messages from pending
        try {
            await interaction.message.delete();
            if (record.embedDiscordid != null)
                await (
                    await interaction.message.channel.messages.fetch(
                        record.embedDiscordid
                    )
                ).delete();
        } catch (error) {
            await interaction.editReply(
                ":x: The record has already been accepted/denied, or something went wrong while deleting the messages from pending"
            );
            logger.info(error);
            return;
        }

        // Create embed to send in archive with all record info
        const archiveEmbed = new EmbedBuilder()
            .setColor(0x8fce00)
            .setTitle(`:white_check_mark: ${record.levelname}`)
            .addFields(
                {
                    name: "Record submitted by",
                    value: `<@${record.submitter}>`,
                    inline: true
                },
                {
                    name: "Record holder",
                    value: `${record.username}`,
                    inline: true
                },
                { name: "Record accepted by", value: `${interaction.user}` },
                { name: "Device", value: `${record.device}`, inline: true },
                {
                    name: "LDM",
                    value: `${record.ldm == 0 ? "None" : record.ldm}`,
                    inline: true
                },
                { name: "Completion link", value: `${record.completionlink}` },
                {
                    name: "Raw link",
                    value: `${record.raw == "" ? "None" : record.raw}`
                },
                { name: "Mod menu", value: `${record.modMenu}` },
                {
                    name: "Additional Info",
                    value: `${
                        record.additionalnotes == ""
                            ? "None"
                            : record.additionalnotes
                    }`
                }
            )
            .setTimestamp();

        // Create embed to send in public channel
        const publicEmbed = new EmbedBuilder()
            .setColor(0x8fce00)
            .setTitle(`:white_check_mark:  ${record.levelname} `)
            .setDescription(
                "Accepted\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800"
            )
            .addFields(
                {
                    name: "Record holder",
                    value: `${record.username}`,
                    inline: true
                },
                { name: "Device", value: `${record.device}`, inline: true }
            );

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
            if (fileRecord.user === record.username) {
                logger.info(
                    `Found existing record of ${filename} for ${record.username}`
                );
                if (fileRecord.percent < (record.percent ?? 0)) {
                    logger.info(
                        "This record has a greater percent on this level, updating..."
                    );
                    fileRecord.percent = record.percent ?? 0;
                    fileRecord.enjoyment = record.enjoyment ?? undefined;
                    fileRecord.link = record.completionlink ?? "";
                    updated = true;
                } else {
                    logger.info(
                        `Canceled adding duplicated record of ${filename} for ${record.username}`
                    );
                    existing = true;
                }
            }
        }

        if (updated === true)
            logger.log("This record has been updated, overwriting...");

        // if the record does not already exist or existed but has been updated
        if (existing === false || updated === true) {
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
                    await db.messageLock.deleteMany({
                        where: { discordid: interaction.message.id }
                    });
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
                    await db.messageLock.deleteMany({
                        where: { discordid: interaction.message.id }
                    });
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
                    await db.messageLock.deleteMany({
                        where: { discordid: interaction.message.id }
                    });
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
                    await db.messageLock.deleteMany({
                        where: { discordid: interaction.message.id }
                    });
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
                    await db.messageLock.deleteMany({
                        where: { discordid: interaction.message.id }
                    });
                    return await interaction.editReply(
                        ":x: Something went wrong while commiting the records to github, please try again later (updateRefError)"
                    );
                }
                logger.info(
                    `Successfully created commit on ${githubBranch} (record addition): ${newCommit.data.sha}`
                );
                try {
                    await db.messageLock.deleteMany({
                        where: { discordid: interaction.message.id }
                    });
                } catch (cleanupError) {
                    logger.info(
                        `Something went wrong while cleaning up the commit database & discord message:\n${cleanupError}`
                    );
                }
                await interaction.editReply(
                    "This record has been accepted and committed!"
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
                    logger.info(
                        `Updated ${changePath} (${interaction.user.tag}`
                    );
                } catch (error) {
                    logger.info(
                        `Failed to update ${changePath} (${interaction.user.tag}):\n${error}`
                    );
                    await interaction.editReply(
                        `:x: Couldn't update the file ${changePath}, skipping...`
                    );
                }
                await interaction.message.delete();
                await interaction.editReply(
                    ":white_check_mark: The record has been accepted"
                );
            }

            // Send all messages simultaneously
            const guild = await interaction.client.guilds.fetch(guildId);

            findTextChannel(guild, acceptedRecordsID)?.send({
                content: "",
                embeds: [acceptEmbed],
                components: [row]
            });
            getTextChannel(guild, archiveRecordsID).send({
                embeds: [archiveEmbed]
            });
            getTextChannel(guild, recordsID).send({
                content: `<@${record.submitter}>`,
                embeds: [publicEmbed]
            });
            getTextChannel(guild, recordsID).send({
                content: `${record.completionlink}`
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
                    const rawGithubCode = JSON.stringify(
                        {
                            user: record.username,
                            link: record.completionlink,
                            percent: 100,
                            hz: 360,
                            ...(record.device === "Mobile" && { mobile: true })
                        },
                        null,
                        "\t"
                    );

                    const dmMessage = `Accepted record of ${record.levelname} for ${record.username}\nGithub Code:`;
                    const dmMessage2 = `${rawGithubCode}`;
                    await interaction.user.send({ content: dmMessage });
                    await interaction.user.send({ content: dmMessage2 });
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

            // Remove record from pending table
            await db.pendingRecord.deleteMany({
                where: { id: record.id }
            });
            // Add record to accepted table
            try {
                await db.acceptedRecord.create({
                    data: {
                        username: record.username,
                        submitter: record.submitter,
                        levelname: record.levelname,
                        device: record.device,
                        fps: record.fps,
                        enjoyment: record.enjoyment,
                        percent: record.percent,
                        completionlink: record.completionlink,
                        raw: record.raw,
                        ldm: record.ldm,
                        modMenu: record.modMenu,
                        additionalnotes: record.additionalnotes,
                        priority: record.priority,
                        moderator: interaction.user.id
                    }
                });
                logger.info(
                    `${interaction.user.tag} (${interaction.user.id}) accepted record of ${record.levelname} for ${record.username} submitted by ${record.submitter}`
                );
            } catch (error) {
                logger.info(
                    `Couldn't add the accepted record ; something went wrong with Prisma : ${error}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while adding the accepted record to the database"
                );
            }

            await incrementDailyStat("nbRecordsAccepted");
            return;
        } else {
            return await interaction.editReply(
                `:x: This user already has a record on this level!`
            );
        }
    }
} satisfies ButtonHandler;
