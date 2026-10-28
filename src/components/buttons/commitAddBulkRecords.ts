import type { ListLevel, ListRecord } from "../../lib/listTypes";
import { getTextChannel } from "../../lib/discord";
import { EmbedBuilder } from "discord.js";
import { config } from "../../lib/config";
import { logger } from "../../lib/logger";
import fs from "node:fs";
import path from "node:path";
import { cloneOrPullRepo, localRepoPath } from "../../lib/gitUtils";
import { incrementProgress } from "../../lib/shiftSystem";
import { db, incrementDailyStat } from "../../lib/db";
import { octokit } from "../../lib/github";
import type { ButtonHandler } from "../types";

const {
    githubDataPath,
    githubOwner,
    githubRepo,
    githubBranch,
    archiveRecordsID,
    guildId
} = config;

export default {
    customId: "commitAddBulkRecords",
    ephemeral: true,
    async execute(interaction) {
        await cloneOrPullRepo();

        const session = await db.bulkRecordSession.findFirst({
            where: {
                moderatorID: interaction.user.id
            }
        });
        if (!session)
            return await interaction.editReply(
                ":x: You're not currently checking bulk records, start a session with /bulkrecord add"
            );

        const records = await db.bulkRecord.findMany({
            where: {
                moderatorID: interaction.user.id
            }
        });

        const changes: { path: string; content: string }[] = [];
        const errored: string[] = [];

        for (const record of records) {
            let parsedData: ListLevel;
            try {
                parsedData = JSON.parse(
                    fs.readFileSync(
                        path.join(localRepoPath, `data/${record.path}.json`),
                        "utf8"
                    )
                );
            } catch (parseError) {
                if (!record.path.startsWith("_"))
                    logger.error(
                        "Git - " +
                            `Unable to parse data from ${record.path}.json:\n${parseError}`
                    );
                errored.push(record.path);
                continue;
            }

            const recordToAdd: ListRecord = {
                user: session.playerName,
                link: session.video,
                percent: record.percent,
                hz: session.fps,
                mobile: session.mobile
            };

            if (record.enjoyment !== null && record.enjoyment !== undefined)
                recordToAdd.enjoyment = record.enjoyment;

            parsedData.records.push(recordToAdd);

            changes.push({
                path: `${githubDataPath}/${record.path}.json`,
                content: JSON.stringify(parsedData, null, "\t")
            });
        }

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
            await db.messageLock.deleteMany({
                where: { discordid: interaction.message.id }
            });
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
            await db.messageLock.deleteMany({
                where: { discordid: interaction.message.id }
            });
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
                message: `Bulk-add ${session.playerName}'s records (${interaction.user.tag})`,
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
            await db.messageLock.deleteMany({
                where: { discordid: interaction.message.id }
            });
            return await interaction.editReply(
                ":x: Something went wrong while commiting to github, please try again later (updateRefError)"
            );
        }
        logger.info(
            `Successfully created commit on ${githubBranch} (record addition): ${newCommit.data.sha}`
        );

        // Send all messages simultaneously
        const guild = await interaction.client.guilds.fetch(guildId);

        const recordsChannel = getTextChannel(guild, archiveRecordsID);

        // staffGuild.channels.cache.get(acceptedRecordsID).send({ content: '', embeds: [acceptEmbed], components: [row] });
        if (session.discordID) {
            await recordsChannel.send({
                content: `<@${session.discordID}>`
            });
        }

        // Check if we need to send in dms as well
        const settings = await db.settings.findFirst({
            where: { moderator: interaction.user.id }
        });

        // Update moderator data (create new entry if that moderator hasn't accepted/denied records before)
        const modInfo = await db.staff.findFirst({
            where: { moderator: interaction.user.id }
        });

        if (!modInfo) {
            await db.staff.create({
                data: {
                    moderator: interaction.user.id,
                    nbRecords: records.length,
                    nbDenied: 0,
                    nbAccepted: records.length
                }
            });
        } else {
            await db.staff.update({
                where: { id: modInfo.id },
                data: { nbRecords: { increment: records.length } }
            });
            await db.staff.update({
                where: { id: modInfo.id },
                data: { nbAccepted: { increment: records.length } }
            });
        }

        await incrementDailyStat(
            "nbRecordsAccepted",
            records.length - errored.length
        );

        await incrementProgress(interaction.user.id, 1);

        const recordEmbeds: EmbedBuilder[] = [];

        for (const record of records) {
            if (errored.includes(record.path)) continue;
            // Create embed to send in public channel
            const publicEmbed = new EmbedBuilder()
                .setColor(0x8fce00)
                .setTitle(`:white_check_mark: ${record.levelname}`)
                .addFields(
                    {
                        name: "Percent",
                        value: `${record.percent}%`,
                        inline: true
                    },
                    {
                        name: "Record holder",
                        value: `${session.playerName}`,
                        inline: true
                    },
                    {
                        name: "Record added by",
                        value: `${interaction.user}`,
                        inline: true
                    },
                    {
                        name: "Device",
                        value: `${session.mobile ? "Mobile" : "PC"} (${
                            session.fps
                        } FPS)`,
                        inline: true
                    },
                    {
                        name: "Video",
                        value: `[Link](${session.video})`,
                        inline: true
                    },
                    {
                        name: "Enjoyment",
                        value:
                            record.enjoyment !== undefined &&
                            record.enjoyment !== null
                                ? `${record.enjoyment}/10`
                                : "None",
                        inline: true
                    }
                );

            recordEmbeds.push(publicEmbed);

            if (!settings) {
                await db.settings.create({
                    data: {
                        moderator: interaction.user.id,
                        sendAcceptedInDM: false
                    }
                });
            } else if (settings.sendAcceptedInDM) {
                try {
                    const notRawGithubCode: ListRecord = {
                        user: session.playerName,
                        link: session.video,
                        percent: record.percent,
                        hz: session.fps,
                        mobile: session.mobile ? true : false
                    };
                    if (
                        record.enjoyment !== null &&
                        record.enjoyment !== undefined
                    )
                        notRawGithubCode.enjoyment = record.enjoyment;

                    const rawGithubCode = JSON.stringify(
                        notRawGithubCode,
                        null,
                        "\t"
                    );

                    const dmMessage = `Accepted record of ${record.levelname} for ${session.playerName}\nGithub Code:\n\`\`\`${rawGithubCode}\`\`\``;
                    await interaction.user.send({ content: dmMessage });
                } catch {
                    logger.info(
                        `Failed to send in moderator ${interaction.user.id} dms, ignoring send in dms setting`
                    );
                }
            }
        }

        if (recordEmbeds.length > 0) {
            for (let i = 0; i < recordEmbeds.length; i += 10) {
                const embedBatch = recordEmbeds.slice(i, i + 10);
                await recordsChannel.send({ embeds: embedBatch });
            }
        }

        if (errored.length > 0) {
            await interaction.editReply(
                `:white_check_mark: Added records, but some records failed to be added:\n${errored.map((path) => `${path}.json`).join(", ")}`
            );
        } else {
            await interaction.editReply(":white_check_mark: Added records!");
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
        return;
    }
} satisfies ButtonHandler;
