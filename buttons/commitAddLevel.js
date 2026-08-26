const {
    githubOwner,
    githubRepo,
    githubDataPath,
    githubBranch,
    guildId,
    staffGuildId,
    enableSeparateStaffServer,
    changelogID,
} = require("../config.json");
const logger = require("log4js").getLogger();
const { EmbedBuilder } = require("discord.js");

module.exports = {
    customId: "commitAddLevel",
    ephemeral: true,
    async execute(interaction) {
        const { octokit, db, cache } = require("../index.js");
        const { enableChangelogMessage } = require("../config.json");

        await interaction.editReply("Committing...");

        // Check for level info corresponding to the message id
        const level = await db.levelsToPlace.findOne({
            where: { discordid: interaction.message.id },
        });

        let mainFilename = level.filename;

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
                branch: githubBranch,
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
                branch: githubBranch,
            });
        } catch {
            logger.info("No changelog file found, creating a new one");
        }

        const list = JSON.parse(
            Buffer.from(list_response.data.content, "base64").toString("utf-8")
        );

        const changelogList = changelog_response
            ? JSON.parse(
                  Buffer.from(
                      changelog_response.data.content,
                      "base64"
                  ).toString("utf-8")
              )
            : [];

        if (level.position < 1 || level.position > list.length + 1) {
            return await interaction.editReply(
                ":x: The given position is incorrect"
            );
        }

        // Check if file already exists
        try {
            await octokit.rest.repos.getContent({
                owner: githubOwner,
                repo: githubRepo,
                path: githubDataPath + `/${mainFilename}.json`,
                branch: githubBranch,
            });
            let creator = JSON.parse(level.githubCode).creators[0];
            (creator = creator
                .normalize("NFD")
                .replace(/[^a-zA-Z0-9 ]/g, "")
                .replace(/ /g, "_")
                .toLowerCase()),
                (mainFilename = level.filename + `_${creator}`);
        } catch (e) {
            e; // lol!
        }

        // filter out all levels that are not dividers
        const noDiv = list.filter((level) => !level.startsWith("_"));

        // get from the index (which is why we use -1)
        const levelBelow = noDiv[level.position - 1];

        // find the index of that level in the real list
        const realBelow = list.indexOf(levelBelow);

        // insert the level above the real list index
        list.splice(realBelow, 0, mainFilename);

        changelogList.push({
            date: Math.floor(new Date().getTime() / 1000),
            action: "placed",
            name: mainFilename,
            to_rank: level.position,
            from_rank: null,
            above: noDiv[level.position] || null,
            below: noDiv[level.position - 2] || null,
        });

        const changes = [
            {
                path: githubDataPath + "/_list.json",
                content: JSON.stringify(list, null, "\t"),
            },
            {
                path: githubDataPath + `/${mainFilename}.json`,
                content: level.githubCode,
            },
            {
                path: githubDataPath + "/_changelog.json",
                content: JSON.stringify(changelogList, null, "\t"),
            },
        ];

        let commitSha;
        try {
            // Get the SHA of the latest commit from the branch
            const { data: refData } = await octokit.git.getRef({
                owner: githubOwner,
                repo: githubRepo,
                ref: `heads/${githubBranch}`,
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
                commit_sha: commitSha,
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
                    content: change.content,
                })),
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
                message: `Placed ${mainFilename} at ${level.position} (${interaction.user.tag})`,
                tree: newTree.data.sha,
                parents: [commitSha],
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
                sha: newCommit.data.sha,
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
            // this was changed to -1 because the lvl to place is
            // never added to the noDiv array
            const above = noDiv[level.position]
                ? await cache.levels.findOne({
                      where: { filename: noDiv[level.position - 1] },
                  })
                : null;
            const below = noDiv[level.position - 2]
                ? await cache.levels.findOne({
                      where: { filename: noDiv[level.position - 2] },
                  })
                : null;

            if (enableChangelogMessage) {
                const levelData = JSON.parse(level.githubCode);
                await db.changelog.create({
                    levelname: levelData.name,
                    old_position: null,
                    new_position: level.position,
                    level_above: above?.name || null,
                    level_below: below?.name || null,
                    action: "placed",
                });

                let message = `${levelData.name} has been placed at #${level.position}, `;
                if (above) message += `above ${above?.name}`;
                if (above && below) message += ` and `;
                if (below) message += `below ${below?.name}`;
                message += ".";

                // Create embed to send in public channel
                const publicEmbed = new EmbedBuilder()
                    .setColor(0x8fce00)
                    .setTitle(`:white_check_mark: ${levelData.name}`)
                    .setDescription(message)
                    .setTimestamp();

                const guild = await interaction.client.guilds.fetch(guildId);

                const announcementMsg = await guild.channels.cache
                    .get(changelogID)
                    .send({
                        embeds: [publicEmbed],
                    });
                await announcementMsg.crosspost();
                await announcementMsg.react("👍");
                await announcementMsg.react("👎");
            }
        } catch (changelogErr) {
            logger.info(
                `An error occured while creating a changelog entry:\n${changelogErr}`
            );
            return await interaction.editReply(
                `:white_check_mark: Successfully created file: **${mainFilename}.json** (${newCommit.data.html_url}), but an error occured while creating a changelog entry`
            );
        }

        logger.info(
            `${interaction.user.tag} (${interaction.user.id}) placed ${mainFilename} at ${level.position}`
        );
        try {
            logger.info(
                `Successfully created commit on ${githubBranch}: ${newCommit.data.sha}`
            );
            db.levelsToPlace.destroy({
                where: { discordid: level.discordid },
            });
            cache.levels.create({
                name: JSON.parse(level.githubCode).name,
                filename: mainFilename,
                position: level.position,
            });
        } catch (cleanupErr) {
            logger.info(
                `Successfully created commit on ${githubBranch}: ${newCommit.data.sha}, but an error occured while cleaning up:\n${cleanupErr}`
            );
        }
        return await interaction.editReply(
            `:white_check_mark: Successfully created file: **${mainFilename}.json** (${newCommit.data.html_url})`
        );
    },
};
