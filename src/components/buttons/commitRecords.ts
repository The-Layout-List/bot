import type { ListLevel, ListRecord } from "../../lib/listTypes";
import { EmbedBuilder } from "discord.js";
import { db } from "../../lib/db";
import { config } from "../../lib/config";
import { logger } from "../../lib/logger";
import { octokit, asFile } from "../../lib/github";
import type { ButtonHandler } from "../types";

const { githubOwner, githubRepo, githubDataPath, githubBranch } = config;

export default {
    customId: "commitRecords",
    ephemeral: true,
    async execute(interaction) {
        const lock = await db.messageLock.findFirst({
            where: { discordid: interaction.message.id }
        });
        if (!lock) {
            await db.messageLock.create({
                data: {
                    discordid: interaction.message.id,
                    locked: true,
                    userdiscordid: interaction.user.id
                }
            });
        } else {
            return await interaction.editReply(
                `:x: This interaction is being used by <@${lock.userdiscordid}>`
            );
        }

        const recordsToCommit = await db.recordToCommit.findMany({
            where: { discordid: interaction.message.id }
        });

        let addedRecords = 0;
        let duplicateRecords = 0;
        const erroredRecords: string[] = [];

        // Caching current file data from github
        const previousContent: Record<string, ListLevel> = {};
        for (const record of recordsToCommit) {
            const filename = record.filename;
            if (!previousContent[filename]) {
                let fileResponse;
                try {
                    fileResponse = await octokit.rest.repos.getContent({
                        owner: githubOwner,
                        repo: githubRepo,
                        path: githubDataPath + `/${filename}.json`,
                        branch: githubBranch
                    });
                } catch (fetchError) {
                    logger.info(
                        `Couldn't fetch ${filename}.json: \n${fetchError}`
                    );
                    continue;
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
                    continue;
                }
                if (!Array.isArray(parsedData.records)) {
                    logger.info(
                        `The records field of the fetched ${filename}.json is not an array`
                    );
                    continue;
                }
                previousContent[filename] = parsedData;
            }
        }
        // Patching together different records for the same file
        interaction.editReply("Looking for duplicate records...");
        const newContent: Record<string, ListRecord[]> = {};
        for (const record of recordsToCommit) {
            const filename = record.filename;
            const githubCode = record.githubCode;
            const user = record.user;

            if (!previousContent[filename]) {
                erroredRecords.push(`${filename}.json (${user})`);
                interaction.editReply(
                    `Found ${duplicateRecords} duplicate and ${erroredRecords.length} errored records...`
                );
                continue;
            }

            // If duplicate, don't add it to githubCodes
            if (
                previousContent[filename].records.some(
                    (fileRecord) => fileRecord.user == user
                )
            ) {
                logger.info(
                    `Canceled adding duplicated record of ${filename} for ${user}`
                );
                await db.recordToCommit.deleteMany({
                    where: { id: record.id }
                });
                duplicateRecords++;
                interaction.editReply(
                    `Found ${duplicateRecords} duplicate and ${erroredRecords.length} errored records...`
                );
                continue;
            }

            let newRecord: ListRecord;
            try {
                newRecord = JSON.parse(githubCode);
            } catch (parseError) {
                logger.info(
                    `Unable to parse data:\n${githubCode}\n${parseError}`
                );
                erroredRecords.push(`${filename}.json (${user})`);
                interaction.editReply(
                    `Found ${duplicateRecords} duplicate and ${erroredRecords.length} errored records...`
                );
                continue;
            }

            // If there's no attribute for that file yet, add it, otherwise concatenate it after the last one
            if (!newContent[filename]) {
                newContent[filename] = [newRecord];
            } else {
                if (
                    newContent[filename].some(
                        (fileRecord) => fileRecord.user === user
                    )
                ) {
                    logger.info(
                        `Canceled adding duplicated record of ${filename} for ${user}`
                    );
                    await db.recordToCommit.deleteMany({
                        where: { id: record.id }
                    });
                    duplicateRecords++;
                    interaction.editReply(
                        `Found ${duplicateRecords} duplicate and ${erroredRecords.length} errored records...`
                    );
                    continue;
                }
                newContent[filename].push(newRecord);
            }
        }

        interaction.editReply("Building changes...");

        const changes: { path: string; content: string }[] = [];
        // Creating changed data
        for (const filename of Object.keys(newContent)) {
            // Patching previouw and new content together
            const content = previousContent[filename];
            content.records = content.records.concat(newContent[filename]);

            // Save changes
            changes.push({
                path: githubDataPath + `/${filename}.json`,
                content: JSON.stringify(content, null, "\t")
            });
            addedRecords += newContent[filename].length;
        }

        if (changes.length === 0) {
            logger.info(
                "No new or updated records to commit after filtering out duplicates and errors."
            );
            await db.messageLock.deleteMany({
                where: { discordid: interaction.message.id }
            });
            return await interaction.editReply(
                ":x: No changes to commit after removing duplicates and handling errors."
            );
        }

        interaction.editReply("Building commit...");
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
                    message: `Added ${addedRecords} records (${interaction.user.tag})`,
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
                await db.recordToCommit.deleteMany({
                    where: { discordid: interaction.message.id }
                });
                await db.messageLock.deleteMany({
                    where: { discordid: interaction.message.id }
                });
                await interaction.message.delete();
            } catch (cleanupError) {
                logger.info(
                    `Something went wrong while cleaning up the commit database & discord message:\n${cleanupError}`
                );
            }

            let detailedErrors = "";
            for (const err of erroredRecords) detailedErrors += `\n${err}`;
            const replyEmbed = new EmbedBuilder()
                .setColor(0x8fce00)
                .setTitle(":white_check_mark: Commit successful")
                .setDescription(
                    `Successfully commited ${addedRecords}/${recordsToCommit.length} records`
                )
                .addFields(
                    {
                        name: "Commit link:",
                        value: `${newCommit.data.html_url}`
                    },
                    {
                        name: "Duplicates found:",
                        value: `**${duplicateRecords}**`,
                        inline: true
                    },
                    {
                        name: "Errors:",
                        value: `${erroredRecords.length}`,
                        inline: true
                    },
                    {
                        name: "Detailed Errors:",
                        value:
                            detailedErrors.length == 0 ? "None" : detailedErrors
                    }
                )
                .setTimestamp();
            return await interaction.editReply({
                content: " ",
                embeds: [replyEmbed]
            });
        } else {
            let updatedFiles = 0;
            let i = 1;

            for (const change of changes) {
                interaction.editReply(
                    `Updating ${change.path} (${i}/${changes.length})...`
                );
                // Get file SHA
                let fileSha;
                try {
                    const response = await octokit.repos.getContent({
                        owner: githubOwner,
                        repo: githubRepo,
                        path: change.path
                    });
                    fileSha = asFile(response.data).sha;
                } catch (error) {
                    logger.info(`Error fetching ${change.path} SHA:\n${error}`);
                    erroredRecords.push(`All from ${change.path}`);
                    await interaction.editReply(
                        `:x: Couldn't fetch data from ${change.path}, skipping...`
                    );
                    i++;
                    continue;
                }

                try {
                    await octokit.repos.createOrUpdateFileContents({
                        owner: githubOwner,
                        repo: githubRepo,
                        path: change.path,
                        message: `Updated ${change.path} (${i}/${changes.length}) (${interaction.user.tag})`,
                        content: Buffer.from(change.content).toString("base64"),
                        sha: fileSha
                    });
                    logger.info(
                        `Updated ${change.path} (${i}/${changes.length}) (${interaction.user.tag}`
                    );
                } catch (error) {
                    logger.info(
                        `Failed to update ${change.path} (${i}/${changes.length}) (${interaction.user.tag}):\n${error}`
                    );
                    erroredRecords.push(`All from ${change.path}`);
                    await interaction.editReply(
                        `:x: Couldn't update the file ${change.path}, skipping...`
                    );
                }
                updatedFiles++;
                i++;
            }

            let detailedErrors = "";
            for (const err of erroredRecords) detailedErrors += `\n${err}`;

            const replyEmbed = new EmbedBuilder()
                .setColor(0x8fce00)
                .setTitle(":white_check_mark: Commit successful")
                .setDescription(
                    `Successfully updated ${updatedFiles}/${changes.length} files`
                )
                .addFields(
                    {
                        name: "Duplicates found:",
                        value: `**${duplicateRecords}**`,
                        inline: true
                    },
                    {
                        name: "Errors:",
                        value: `${erroredRecords.length}`,
                        inline: true
                    },
                    {
                        name: "Detailed Errors:",
                        value:
                            detailedErrors.length == 0 ? "None" : detailedErrors
                    }
                )
                .setTimestamp();
            await interaction.message.delete();
            return await interaction.editReply({
                content: " ",
                embeds: [replyEmbed]
            });
        }
    }
} satisfies ButtonHandler;
