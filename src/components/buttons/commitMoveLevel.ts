import { getTextChannel } from "../../lib/discord";
import { EmbedBuilder } from "discord.js";
import type { ListOrder } from "../../lib/listTypes";
import { config } from "../../lib/config";
import { logger } from "../../lib/logger";
import { octokit, asFile } from "../../lib/github";
import { db } from "../../lib/db";
import type { ButtonHandler } from "../types";

const {
    githubOwner,
    githubRepo,
    githubDataPath,
    githubBranch,
    changelogID,
    guildId
} = config;

export default {
    customId: "commitMoveLevel",
    ephemeral: true,
    async execute(interaction) {
        const { enableChangelogMessage } = config;

        // Check for level info corresponding to the message id
        const level = await db.levelToMove.findFirst({
            where: { discordid: interaction.message.id }
        });
        if (!level) {
            await interaction.editReply(
                ":x: This action is no longer available"
            );
            return await interaction.message.delete();
        }

        let list_response;
        let changelog_response;
        try {
            list_response = await octokit.rest.repos.getContent({
                owner: githubOwner,
                repo: githubRepo,
                path: githubDataPath + "/_list.json",
                branch: githubBranch
            });
        } catch {
            return await interaction.editReply(
                ":x: Something went wrong while fetching data from github, please try again later"
            );
        }

        try {
            changelog_response = await octokit.rest.repos.getContent({
                owner: githubOwner,
                repo: githubRepo,
                path: githubDataPath + "/_changelog.json",
                branch: githubBranch
            });
        } catch {
            logger.info("No changelog file found, creating a new one");
        }

        const list: ListOrder = JSON.parse(
            Buffer.from(asFile(list_response.data).content, "base64").toString(
                "utf-8"
            )
        );

        const noDiv = list.filter((level) => !level.startsWith("_"));

        const currentPosition = noDiv.indexOf(level.filename) + 1;
        const realCurrentPosition = list.indexOf(level.filename) + 1;
        if (currentPosition == 0)
            return await interaction.editReply(
                ":x: The given level is not on the list"
            );

        const changelogList = changelog_response
            ? JSON.parse(
                  Buffer.from(
                      asFile(changelog_response.data).content,
                      "base64"
                  ).toString("utf-8")
              )
            : [];

        if (level.position < 1 || level.position > noDiv.length + 1) {
            return await interaction.editReply(
                ":x: The given position is incorrect"
            );
        }

        const lowered = currentPosition < level.position;

        // get the level below the level we want to place
        // +2 because 1 is index offset and 1 is to get the level underneath
        const levelBelow = noDiv[level.position - 1];
        const levelAbove = noDiv[level.position - 2];

        // find the index of that level in the real list
        const realBelow = list.indexOf(levelBelow);

        // insert the level above the real list index
        list.splice(realBelow, 0, level.filename);

        // -1 bc indexes
        list.splice(lowered ? realCurrentPosition - 1 : realCurrentPosition, 1);

        changelogList.push({
            date: Math.floor(new Date().getTime() / 1000),
            action: currentPosition < level.position ? "lowered" : "raised",
            name: level.filename,
            to_rank: level.position,
            from_rank: currentPosition,
            above: levelBelow,
            below: levelAbove
        });

        const changes = [
            {
                path: githubDataPath + "/_list.json",
                content: JSON.stringify(list, null, "\t")
            },
            {
                path: githubDataPath + "/_changelog.json",
                content: JSON.stringify(changelogList, null, "\t")
            }
        ];

        let commitSha;
        try {
            // Get the SHA of the latest commit from the branch
            const { data: refData } = await octokit.git.getRef({
                owner: githubOwner,
                repo: githubRepo,
                ref: `heads/${githubBranch}`
            });
            commitSha = refData.object.sha;
        } catch (getRefErr) {
            logger.info(
                `Something went wrong while getting the latest commit SHA: \n${getRefErr}`
            );
            return await interaction.editReply(
                ":x: Couldn't commit to github, please try again later (getRefError)"
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
        } catch (getCommitErr) {
            logger.info(
                `Something went wrong while getting the latest commit: \n${getCommitErr}`
            );
            return await interaction.editReply(
                ":x: Couldn't commit to github, please try again later (getCommitError)"
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
        } catch (createTreeErr) {
            logger.info(
                `Something went wrong while creating a new tree: \n${createTreeErr}`
            );
            return await interaction.editReply(
                ":x: Couldn't commit to github, please try again later (createTreeError)"
            );
        }

        let newCommit;
        try {
            // Create a new commit with this tree
            newCommit = await octokit.git.createCommit({
                owner: githubOwner,
                repo: githubRepo,
                message: `${lowered ? "Lowered" : "Raised"} ${
                    level.filename
                } from ${currentPosition} to ${level.position} (${
                    interaction.user.tag
                })`,
                tree: newTree.data.sha,
                parents: [commitSha]
            });
        } catch (createCommitErr) {
            logger.info(
                `Something went wrong while creating a new commit: \n${createCommitErr}`
            );
            return await interaction.editReply(
                ":x: Couldn't commit to github, please try again later (createCommitError)"
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
        } catch (updateRefErr) {
            logger.info(
                `Something went wrong while updating the branch reference: \n${updateRefErr}`
            );
            return await interaction.editReply(
                ":x: Couldn't commit to github, please try again later (updateRefError)"
            );
        }

        try {
            const above = levelAbove
                ? await db.cachedLevel.findFirst({
                      where: { filename: levelAbove }
                  })
                : null;
            const below = levelBelow
                ? await db.cachedLevel.findFirst({
                      where: { filename: levelBelow }
                  })
                : null;
            const levelname = (
                await db.cachedLevel.findFirst({
                    where: { filename: level.filename }
                })
            )?.name;

            if (enableChangelogMessage) {
                await db.changelog.create({
                    data: {
                        levelname: levelname,
                        old_position: currentPosition,
                        new_position: level.position,
                        level_above: below?.name || null,
                        level_below: above?.name || null,
                        action: lowered ? "lowered" : "raised"
                    }
                });

                let message = `**${levelname}** has been ${lowered ? "lowered" : "raised"} from #${currentPosition} to #${level.position}, `;
                if (above) message += `above **${below?.name}**`;
                if (above && below) message += ` and `;
                if (below) message += `below **${above?.name}**`;
                message += ".";

                // Create embed to send in public channel
                const publicEmbed = new EmbedBuilder()
                    .setColor(0x00d3ff)
                    .setTitle(`:arrow_${lowered ? "down" : "up"}: ${levelname}`)
                    .setDescription(message)
                    .setTimestamp();

                const guild = await interaction.client.guilds.fetch(guildId);

                const channel = getTextChannel(guild, changelogID);

                const announcementMsg = await channel.send({
                    embeds: [publicEmbed]
                });
                await announcementMsg.crosspost();
                await announcementMsg.react("👍");
                await announcementMsg.react("👎");
            }
        } catch (changelogErr) {
            logger.error(
                `An error occured while creating a changelog entry:\n${changelogErr}`
            );
            return await interaction.editReply(
                `:white_check_mark: Successfully moved **${level.filename}.json** (${newCommit.data.html_url}), but an error occured while creating a changelog entry`
            );
        }

        logger.info(
            `${interaction.user.tag} (${interaction.user.id}) moved ${level.filename} from ${currentPosition} to ${level.position}`
        );
        try {
            logger.info(
                `Successfully created commit on ${githubBranch}: ${newCommit.data.sha}`
            );
            await db.levelToMove.deleteMany({
                where: { discordid: level.discordid }
            });
        } catch (cleanupErr) {
            logger.info(
                `Successfully created commit on ${githubBranch}: ${newCommit.data.sha}, but an error occured while cleanin up:\n${cleanupErr}`
            );
        }

        await db.cachedLevel.updateMany({
            where: { filename: level.filename },
            data: { position: level.position }
        });

        return await interaction.editReply(
            `:white_check_mark: Successfully moved **${level.filename}.json** (${newCommit.data.html_url})`
        );
    }
} satisfies ButtonHandler;
