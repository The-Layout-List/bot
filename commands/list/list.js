const {
    SlashCommandBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    AttachmentBuilder,
} = require("discord.js");
const {
    githubOwner,
    githubRepo,
    githubDataPath,
    githubBranch,
} = require("../../config.json");
const logger = require("log4js").getLogger();
const Sequelize = require("sequelize");

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("list")
        .setDescription("Staff list management")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("place")
                .setDescription("Place a level on the list")
                .addStringOption((option) =>
                    option
                        .setName("levelname")
                        .setDescription("The name of the level to place")
                        .setRequired(true)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("position")
                        .setDescription("The position to place the level at")
                        .setRequired(true)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("difficulty")
                        .addChoices(
                            { name: "Beginner", value: 0 },
                            { name: "Easy", value: 1 },
                            { name: "Medium", value: 2 },
                            { name: "Hard", value: 3 },
                            { name: "Insane", value: 4 },
                            { name: "Mythical", value: 5 },
                            { name: "Extreme", value: 6 },
                            { name: "Supreme", value: 7 },
                            { name: "Ethereal", value: 8 },
                            { name: "Legendary", value: 9 },
                            { name: "Silent", value: 10 },
                            { name: "Impossible", value: 11 },
                            { name: "Unfathomable", value: 12 },
                        )
                        .setDescription(
                            "The minimum percent players need to get a record on this level"
                        )
                        .setRequired(true)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("id")
                        .setDescription("The GD ID of the level to place")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("creators")
                        .setDescription(
                            "The list of the creators of the level, each separated by a comma"
                        )
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("verifier")
                        .setDescription("The name of the verifier")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("verification")
                        .setDescription(
                            "The link to the level's verification video"
                        )
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("songname")
                        .setDescription("The name of this level's song")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("songlink")
                        .setDescription("The NONG link for this level, if any.")
                )
                .addStringOption((option) =>
                    option
                        .setName("password")
                        .setDescription("The GD password of the level to place")
                )
                .addIntegerOption((option) =>
                    option
                        .setName("percent")
                        .setDescription(
                            "The minimum percent players need to get a record on this level (list percent)"
                        )
                )
                .addIntegerOption((option) =>
                    option
                        .setName("enjoyment")
                        .setDescription(
                            "The verifier's enjoyment on this level (1-10)"
                        )
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("move")
                .setDescription("Moves a level to another position on the list")
                .addStringOption((option) =>
                    option
                        .setName("levelname")
                        .setDescription("The name of the level to move")
                        .setAutocomplete(true)
                        .setMinLength(1)
                        .setRequired(true)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("position")
                        .setDescription("The new position to move the level at")
                        .setMinValue(1)
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("remove")
                .setDescription("Remove/hide a level from the list")
                .addStringOption((option) =>
                    option
                        .setName("levelname")
                        .setDescription("The name of the level to delete")
                        .setRequired(true)
                        .setMaxLength(1024)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("edit")
                .setDescription("Edit a level's info")
                .addStringOption((option) =>
                    option
                        .setName("level")
                        .setDescription("The name of the level to edit")
                        .setAutocomplete(true)
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("levelname")
                        .setDescription("The name of the level to place")
                )
                .addIntegerOption((option) =>
                    option
                        .setName("difficulty")
                        .addChoices(
                            { name: "Beginner", value: 0 },
                            { name: "Easy", value: 1 },
                            { name: "Medium", value: 2 },
                            { name: "Hard", value: 3 },
                            { name: "Insane", value: 4 },
                            { name: "Mythical", value: 5 },
                            { name: "Extreme", value: 6 },
                            { name: "Supreme", value: 7 },
                            { name: "Ethereal", value: 8 },
                            { name: "Legendary", value: 9 },
                            { name: "Silent", value: 10 },
                            { name: "Impossible", value: 11 },
                            { name: "Unfathomable", value: 12 },
                        )
                        .setDescription(
                            "The tier the level is in (1-10, see the list website for details)"
                        )
                )
                .addIntegerOption((option) =>
                    option
                        .setName("id")
                        .setDescription("The GD ID of the level to place")
                )
                .addStringOption((option) =>
                    option
                        .setName("verifier")
                        .setDescription("The name of the verifier")
                )
                .addStringOption((option) =>
                    option
                        .setName("verification")
                        .setDescription(
                            "The link to the level's verification video"
                        )
                )
                .addStringOption((option) =>
                    option
                        .setName("songname")
                        .setDescription("The name of this level's song")
                )
                .addStringOption((option) =>
                    option
                        .setName("songlink")
                        .setDescription("The NONG link for this level, if any.")
                )
                .addStringOption((option) =>
                    option
                        .setName("creators")
                        .setDescription(
                            "The list of the creators of the level, each separated by a comma"
                        )
                )
                .addStringOption((option) =>
                    option
                        .setName("password")
                        .setDescription("The GD password of the level to place")
                )
                .addIntegerOption((option) =>
                    option
                        .setName("percent")
                        .setDescription(
                            "The minimum percent players need to get a record on this level (list percent)"
                        )
                )
                .addIntegerOption((option) =>
                    option
                        .setName("enjoyment")
                        .setDescription(
                            "The verifier's enjoyment on this level (1-10)"
                        )
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("renameuser")
                .setDescription("Rename a user")
                .addStringOption((option) =>
                    option
                        .setName("username")
                        .setDescription("The name of the user to rename")
                        .setAutocomplete(true)
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("newusername")
                        .setDescription("The new name of the user")
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("restore")
                .setDescription("Restore a level that has been removed")
                .addStringOption((option) =>
                    option
                        .setName("levelname")
                        .setDescription("The name of the level to restore")
                        .setAutocomplete(true)
                        .setRequired(true)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("position")
                        .setDescription("The position to restore the level at")
                        .setRequired(true)
                )
        ),
    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true);
        const { cache } = require("../../index.js");
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "renameuser")
            return await interaction.respond(
                (
                    await cache.users.findAll({ where: {} })
                )
                    .filter((user) =>
                        user.name
                            .toLowerCase()
                            .includes(focused.value.toLowerCase())
                    )
                    .slice(0, 25)
                    .map((user) => ({ name: user.name, value: user.name }))
            );
        else if (subcommand === "restore") {
            let levels = await cache.archived.findAll({
                where: {
                    name: Sequelize.where(
                        Sequelize.fn("LOWER", Sequelize.col("name")),
                        "LIKE",
                        "%" + focused.value.toLowerCase() + "%"
                    ),
                },
            });
            return await interaction.respond(
                levels.slice(0, 25).map((level) => ({
                    name: level.name,
                    value: level.filename,
                }))
            );
        } else if (focused.name === "verifier") {
            let users = await cache.users.findAll({
                where: {
                    name: Sequelize.where(
                        Sequelize.fn("LOWER", Sequelize.col("name")),
                        "LIKE",
                        "%" + focused.value.toLowerCase() + "%"
                    ),
                },
            });
            return await interaction.respond(
                users
                    .slice(0, 25)
                    .map((user) => ({ name: user.name, value: user.name }))
            );
        } else
            return await interaction.respond(
                (
                    await (subcommand === "fromlegacy"
                        ? cache.legacy_levels
                        : cache.levels
                    ).findAll({ where: {} })
                )
                    .filter((level) =>
                        level.name
                            .toLowerCase()
                            .includes(focused.value.toLowerCase())
                    )
                    .slice(0, 25)
                    .map((level) => ({
                        name: `#${level.position} - ${level.name}`,
                        value: level.filename,
                    }))
            );
    },
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        if (interaction.options.getSubcommand() === "place") {
            await interaction.editReply("Placing level...");

            const { db, cache, octokit } = require("../../index.js");

            const levelname = interaction.options.getString("levelname");
            const position = interaction.options.getInteger("position");
            const id = interaction.options.getInteger("id");
            const verifierName = interaction.options.getString("verifier");
            const verification = interaction.options.getString("verification");
            const password =
                interaction.options.getString("password") == null
                    ? "Free to copy"
                    : interaction.options.getString("password");
            const rawCreators = interaction.options.getString("creators");
            const creatorNames = rawCreators ? rawCreators.split(",") : [];
            const percent = interaction.options.getInteger("percent") || 100;
            const difficulty = interaction.options.getInteger("difficulty");
            const songName = interaction.options.getString("songname");
            const songLink = interaction.options.getString("songlink") || null;
            const enjoyment =
                interaction.options.getInteger("enjoyment") || null;

            const finalCreators = [];
            for (const creatorName of creatorNames) {
                finalCreators.push(creatorName.trim()); // lol
            }

            if (enjoyment && (enjoyment < 1 || enjoyment > 10))
                return await interaction.editReply(
                    ":x: Couldn't add the record: Verifier enjoyment rating must be between 1 and 10"
                );

            if (percent && (percent < 0 || percent > 100))
                return await interaction.editReply(
                    ":x: Couldn't add the record: List % must be between 0 and 100"
                );

            if (creatorNames.length > 0)
                for (const creatorName of creatorNames) {
                    let creator = await cache.users.findOne({
                        where: { name: creatorName },
                    });

                    if (!creator)
                        cache.users.create({
                            name: creatorName,
                        });
                }

            const dbVerifier = await cache.users.findOne({
                where: { name: verifierName },
            });

            if (!dbVerifier)
                cache.users.create({
                    name: verifierName,
                });

            let list_response;
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

            const list = JSON.parse(
                Buffer.from(list_response.data.content, "base64").toString(
                    "utf-8"
                )
            );

            // filter out all levels that are not dividers
            const noDiv = list.filter((level) => !level.startsWith("_"));

            const indexBelow = noDiv[position - 1];

            await interaction.editReply("Coding...");
            const githubCode =
                `{\n\t"id": ${id},\n\t"name": "${levelname}",\n\t"creators": ${JSON.stringify(
                    finalCreators
                )},\n\t"verifier": "${verifierName}",\n\t"verification": "${verification}",\n\t"percentToQualify": ${percent},\n\t"password": "${password}",\n\t"difficulty": ${difficulty},\n\t"song": "${songName}",` +
                (songLink !== null ? `\n\t"songLink": "${songLink}",` : "") +
                (enjoyment !== null ? `\n\t"enjoyment": ${enjoyment},` : "") +
                `\n\t"records": []\n}`;

            const levelBelow = await cache.levels.findOne({
                where: { filename: indexBelow },
            });
            const levelAbove = await cache.levels.findOne({
                where: { position: levelBelow.position - 1 },
            });
            const placeEmbed = new EmbedBuilder()
                .setColor(0x8fce00)
                .setTitle(`Place Level: ${levelname}`)
                .setDescription(
                    `**${levelname}** will be placed at **#${position}**, above **${
                        levelBelow ? levelBelow.name : "-"
                    }** and below **${levelAbove ? levelAbove.name : "-"}**`
                )
                .addFields(
                    { name: "ID:", value: `${id}`, inline: true },
                    {
                        name: "Creators:",
                        value: `${
                            rawCreators
                                ? rawCreators.slice(0, 1023)
                                : "None provided"
                        }`,
                        inline: true,
                    },
                    {
                        name: "Verifier:",
                        value: `${verifierName}`,
                        inline: true,
                    },
                    {
                        name: "Verification:",
                        value: `${verification}`,
                        inline: true,
                    },
                    { name: "Password:", value: `${password}`, inline: true },
                    { name: "Percent:", value: `${percent}`, inline: true },
                    {
                        name: "Difficulty:",
                        value: `${difficulty}`,
                        inline: true,
                    }
                )
                .setTimestamp();
            // Create commit buttons
            const commit = new ButtonBuilder()
                .setCustomId("commitAddLevel")
                .setLabel("Commit changes")
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(commit);

            await interaction.editReply({
                content: "Confirm:",
                embeds: [placeEmbed],
                components: [row],
            });
            const sent = await interaction.fetchReply();

            try {
                await db.levelsToPlace.create({
                    filename: levelname
                        .normalize("NFD")
                        .replace(/[^a-zA-Z0-9 ]/g, "")
                        .replace(/ /g, "_")
                        .toLowerCase(),
                    position: position,
                    githubCode: githubCode,
                    discordid: sent.id,
                });
            } catch (error) {
                logger.info(
                    `Couldn't register the level ; something went wrong with Sequelize : ${error}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while adding the level; Please try again later"
                );
            }
            return;
        } else if (interaction.options.getSubcommand() === "edit") {
            const { db, cache, octokit } = require("../../index.js");
            const level = interaction.options.getString("level") || null;
            const levelname =
                interaction.options.getString("levelname") || null;
            const id = interaction.options.getInteger("id") || null;
            const uploaderName =
                interaction.options.getString("uploader") || null;
            const verifierName =
                interaction.options.getString("verifier") || null;
            const verification =
                interaction.options.getString("verification") || null;
            const password = interaction.options.getString("password") || null;
            const rawCreators =
                interaction.options.getString("creators") || null;
            const creatorNames = rawCreators ? rawCreators.split(",") : [];
            const percent = interaction.options.getInteger("percent") || null;
            const difficulty =
                interaction.options.getInteger("difficulty") || null;
            const songName = interaction.options.getString("songname") || null;
            const songLink = interaction.options.getString("songlink") || null;
            const enjoyment =
                interaction.options.getInteger("enjoyment") || null;

            const levelToEdit = await cache.levels.findOne({
                where: { filename: level },
            });
            let finalCreators = [];
            for (const creatorName of creatorNames) {
                finalCreators.push(creatorName.trim()); // lol
            }
            if (!levelToEdit)
                return await interaction.editReply(
                    ":x: The level you are trying to edit does not exist"
                );
            const filename = levelToEdit.filename;
            let fileResponse;
            try {
                fileResponse = await octokit.rest.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/${filename}.json`,
                    branch: githubBranch,
                });
            } catch (fetchError) {
                logger.info(`Couldn't fetch ${filename}.json: \n${fetchError}`);
                return await interaction.editReply(
                    `:x: Couldn't fetch ${filename}.json: \n${fetchError}`
                );
            }

            let parsedData;
            try {
                parsedData = JSON.parse(
                    Buffer.from(fileResponse.data.content, "base64").toString(
                        "utf-8"
                    )
                );
            } catch (parseError) {
                logger.info(
                    `Unable to parse data fetched from ${filename}:\n${parseError}`
                );
                return await interaction.editReply(
                    `:x: Unable to parse data fetched from ${filename}:\n${parseError}`
                );
            }

            if (levelname !== null) parsedData.name = levelname;
            if (id !== null) parsedData.id = id;
            if (uploaderName !== null) parsedData.author = uploaderName;
            if (verifierName !== null) parsedData.verifier = verifierName;
            if (verification !== null) parsedData.verification = verification;
            if (password !== null) parsedData.password = password;
            if (finalCreators.length > 0) parsedData.creators = finalCreators;
            if (percent !== null) parsedData.percentToQualify = percent;
            if (difficulty !== null) parsedData.difficulty = difficulty;
            if (songName !== null) parsedData.song = songName;
            if (songLink !== null) parsedData.songLink = songLink;
            if (enjoyment !== null) parsedData.enjoyment = enjoyment;

            let existing = true;

            if (
                levelname !== null ||
                id !== null ||
                uploaderName !== null ||
                verifierName !== null ||
                verification !== null ||
                password !== null ||
                finalCreators.length > 0 ||
                percent !== null ||
                difficulty !== null ||
                songName !== null ||
                songLink !== null ||
                enjoyment !== null
            )
                existing = false;

            if (existing) {
                return await interaction.editReply(
                    "You didn't change anything"
                );
            }
            await interaction.editReply("Committing...");

            let changes = [];
            changes.push({
                path: githubDataPath + `/${filename}.json`,
                content: JSON.stringify(parsedData, null, "\t"),
            });

            const changePath = githubDataPath + `/${filename}.json`;
            const content = JSON.stringify(parsedData);

            const debugStatus = await db.infos.findOne({
                where: { name: "commitdebug" },
            });
            if (!debugStatus || !debugStatus.status) {
                let commitSha;
                try {
                    // Get the SHA of the latest commit from the branch
                    const { data: refData } = await octokit.git.getRef({
                        owner: githubOwner,
                        repo: githubRepo,
                        ref: `heads/${githubBranch}`,
                    });
                    commitSha = refData.object.sha;
                } catch (getRefError) {
                    logger.info(
                        `Something went wrong while fetching the latest commit SHA:\n${getRefError}`
                    );
                    await db.messageLocks.destroy({
                        where: { discordid: interaction.message.id },
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
                        commit_sha: commitSha,
                    });
                    treeSha = commitData.tree.sha;
                } catch (getCommitError) {
                    logger.info(
                        `Something went wrong while fetching the latest commit:\n${getCommitError}`
                    );
                    await db.messageLocks.destroy({
                        where: { discordid: interaction.message.id },
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
                            content: change.content,
                        })),
                    });
                } catch (createTreeError) {
                    logger.info(
                        `Something went wrong while creating a new tree:\n${createTreeError}`
                    );
                    await db.messageLocks.destroy({
                        where: { discordid: interaction.message.id },
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
                        message: `Updated info for ${levelToEdit.name} (${interaction.user.tag})`,
                        tree: newTree.data.sha,
                        parents: [commitSha],
                    });
                } catch (createCommitError) {
                    logger.info(
                        `Something went wrong while creating a new commit:\n${createCommitError}`
                    );
                    await db.messageLocks.destroy({
                        where: { discordid: interaction.message.id },
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
                        sha: newCommit.data.sha,
                    });
                } catch (updateRefError) {
                    logger.info(
                        `Something went wrong while updating the branch :\n${updateRefError}`
                    );
                    await db.messageLocks.destroy({
                        where: { discordid: interaction.message.id },
                    });
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
                        path: changePath,
                    });
                    fileSha = response.data.sha;
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
                        sha: fileSha,
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
            }

            logger.info(
                `${interaction.user.tag} (${
                    interaction.user.id
                }) submitted ${interaction.options.getString(
                    "levelname"
                )} for ${interaction.options.getString("username")}`
            );
            // Reply
            await interaction.editReply(
                `:white_check_mark: ${levelToEdit.name} has been edited successfully`
            );
            return;
        } else if (interaction.options.getSubcommand() === "move") {
            const { db, octokit, cache } = require("../../index.js");

            const levelfile = interaction.options.getString("levelname");
            const position = interaction.options.getInteger("position");

            let list_response;
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

            const list = JSON.parse(
                Buffer.from(list_response.data.content, "base64").toString(
                    "utf-8"
                )
            );
            const noDiv = list.filter((level) => !level.startsWith("_"));
            const currentPosition = list.indexOf(levelfile);
            const lowered = currentPosition < position;
            const indexBelow = noDiv[position - 1];

            const levelBelow = await cache.levels.findOne({
                where: { filename: indexBelow },
            });
            const levelAbove = await cache.levels.findOne({
                where: { position: levelBelow.position - 1 },
            });

            if (currentPosition == -1)
                return await interaction.editReply(
                    ":x: The level you are trying to move is not on the list"
                );

            const moveEmbed = new EmbedBuilder()
                .setColor(0x8fce00)
                .setTitle(`Move Level: ${levelfile}`)
                .setDescription(
                    `**${levelfile}** will be ${
                        lowered ? "lowered" : "raised"
                    } to **#${position}**, above **${
                        levelBelow.name ?? "-"
                    }** and below **${levelAbove.name ?? "-"}**`
                )
                .setTimestamp();

            // Create commit buttons
            const commit = new ButtonBuilder()
                .setCustomId("commitMoveLevel")
                .setLabel("Commit changes")
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(commit);

            await interaction.editReply({
                embeds: [moveEmbed],
                components: [row],
            });
            const sent = await interaction.fetchReply();

            try {
                await db.levelsToMove.create({
                    filename: levelfile,
                    position: position,
                    discordid: sent.id,
                });
            } catch (error) {
                logger.info(
                    `Couldn't register the level to move ; something went wrong with Sequelize : ${error}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while moving the level; Please try again later"
                );
            }
            return;
        } else if (interaction.options.getSubcommand() === "tolegacy") {
            const { db, octokit } = require("../../index.js");

            const levelfile = interaction.options.getString("levelname");

            let list_response;
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

            const list = JSON.parse(
                Buffer.from(list_response.data.content, "base64").toString(
                    "utf-8"
                )
            );
            const currentPosition = list.indexOf(levelfile);

            if (currentPosition == -1)
                return await interaction.editReply(
                    ":x: The level you are trying to move is not on the list"
                );

            const moveEmbed = new EmbedBuilder()
                .setColor(0x8fce00)
                .setTitle(`Move to Legacy: ${levelfile}`)
                .setDescription(
                    `**${levelfile}** will be moved from **#${
                        currentPosition + 1
                    }** to the top of the **legacy** list (**#${list.length}**)`
                )
                .setTimestamp();

            const commit = new ButtonBuilder()
                .setCustomId("commitLevelToLegacy")
                .setLabel("Commit changes")
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(commit);

            await interaction.editReply({
                embeds: [moveEmbed],
                components: [row],
            });
            const sent = await interaction.fetchReply();

            try {
                await db.levelsToLegacy.create({
                    filename: levelfile,
                    discordid: sent.id,
                });
            } catch (error) {
                logger.info(
                    `Couldn't register the level to move ; something went wrong with Sequelize : ${error}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while moving the level; Please try again later"
                );
            }
            return;
        } else if (interaction.options.getSubcommand() === "fromlegacy") {
            const { db, octokit } = require("../../index.js");

            const levelfile = interaction.options.getString("levelname");
            const position = interaction.options.getInteger("position");

            let list_response;
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

            const list = JSON.parse(
                Buffer.from(list_response.data.content, "base64").toString(
                    "utf-8"
                )
            );

            const levelAbove = list[position - 2] ?? null;
            const levelBelow = list[position - 1] ?? null;

            const moveEmbed = new EmbedBuilder()
                .setColor(0x8fce00)
                .setTitle(`Move Level: ${levelfile}`)
                .setDescription(
                    `**${levelfile}** will be moved from **legacy** to **#${position}**, above **${
                        levelBelow ?? "-"
                    }** and below **${levelAbove ?? "-"}**`
                )
                .setTimestamp();

            // Create commit buttons
            const commit = new ButtonBuilder()
                .setCustomId("commitLevelFromLegacy")
                .setLabel("Commit changes")
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(commit);

            await interaction.editReply({
                embeds: [moveEmbed],
                components: [row],
            });
            const sent = await interaction.fetchReply();

            try {
                await db.levelsFromLegacy.create({
                    filename: levelfile,
                    position: position,
                    discordid: sent.id,
                });
            } catch (error) {
                logger.info(
                    `Couldn't register the level to move ; something went wrong with Sequelize : ${error}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while moving the level; Please try again later"
                );
            }
            return;
        } else if (interaction.options.getSubcommand() === "renameuser") {
            const { cache, octokit } = require("../../index.js");
            const path = require("path");
            const fs = require("fs");
            const {
                githubOwner,
                githubRepo,
                githubDataPath,
                githubBranch,
            } = require("../../config.json");
            const { cloneOrPullRepo } = require("../../others/gitUtils.js");
            await cloneOrPullRepo();

            const olduser = interaction.options.getString("username");
            const newuser = interaction.options.getString("newusername");

            const changes = [];

            const localRepoPath = path.resolve(__dirname, `../../data/repo/`);
            const listFilename = "data/_list.json";
            let list_data;
            try {
                list_data = JSON.parse(
                    fs.readFileSync(
                        path.join(localRepoPath, listFilename),
                        "utf8"
                    )
                );
            } catch (parseError) {
                if (!listFilename.startsWith("_"))
                    logger.error(
                        "Git - " +
                            `Unable to parse data from ${listFilename}:\n${parseError}`
                    );
                return -1;
            }
            for (const filename of list_data) {
                let edited = false;
                let parsedData;
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

                if (parsedData.author === olduser) {
                    parsedData.author = newuser;
                    edited = true;
                }

                if (parsedData.verifier === olduser) {
                    parsedData.verifier = newuser;
                    edited = true;
                }

                for (let i = 0; i < parsedData.creators.length; i++) {
                    if (parsedData.creators[i] === olduser) {
                        parsedData.creators[i] = newuser;
                        edited = true;
                    }
                }

                for (let record of parsedData.records) {
                    if (record.user === olduser) {
                        record.user = newuser;
                        edited = true;
                    }
                }

                if (edited)
                    changes.push({
                        path: githubDataPath + `/${filename}.json`,
                        content: JSON.stringify(parsedData, null, "\t"),
                    });
            }

            // remove old flag entry and set a new one
            const flagsFilename = "data/_flags.json";
            let flags;
            try {
                flags = JSON.parse(
                    fs.readFileSync(
                        path.join(localRepoPath, flagsFilename),
                        "utf8"
                    )
                );
            } catch (parseError) {
                if (!flagsFilename.startsWith("_"))
                    logger.error(
                        "Git - " +
                            `Unable to parse data from ${listFilename}:\n${parseError}`
                    );
                return;
            }

            if (flags[olduser] && !flags[newuser]) {
                flags[newuser] = flags[olduser];
                delete flags[olduser];
                changes.push({
                    path: githubDataPath + `/_flags.json`,
                    content: JSON.stringify(flags, null, "\t"),
                });
            }

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
                    `Failed to get the latest commit SHA: ${getRefErr}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while renaming the user; please try again later"
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
                logger.info(`Failed to get the commit SHA: ${getCommitErr}`);
                return await interaction.editReply(
                    ":x: Something went wrong while renaming the user; please try again later"
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
                logger.info(`Failed to create a new tree: ${createTreeErr}`);
                return await interaction.editReply(
                    ":x: Something went wrong while renaming the user; please try again later"
                );
            }

            let newCommit;
            try {
                // Create a new commit with this tree
                newCommit = await octokit.git.createCommit({
                    owner: githubOwner,
                    repo: githubRepo,
                    message: `Rename ${olduser} to ${newuser} (${interaction.user.tag})`,
                    tree: newTree.data.sha,
                    parents: [commitSha],
                });
            } catch (createCommitErr) {
                logger.info(
                    `Failed to create a new commit: ${createCommitErr}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while renaming the user; please try again later"
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
                logger.info(`Failed to update the branch: ${updateRefErr}`);
                return await interaction.editReply(
                    ":x: Something went wrong while renaming the user; please try again later"
                );
            }

            const { db } = require("../../index.js");
            try {
                await db.pendingRecords.update(
                    { username: newuser },
                    { where: { username: olduser } }
                );
                await db.acceptedRecords.update(
                    { username: newuser },
                    { where: { username: olduser } }
                );
                await db.deniedRecords.update(
                    { username: newuser },
                    { where: { username: olduser } }
                );
            } catch (error) {
                logger.info(
                    `Failed to update records (username change): ${error}`
                );
            }
            cache.updateUsers();
            logger.info(
                `${interaction.user.tag} renamed ${olduser} to ${newuser}`
            );
            return await interaction.editReply(
                `:white_check_mark: Successfully renamed **${olduser}** to **${newuser}**`
            );
        } else if (interaction.options.getSubcommand() === "mutualvictors") {
            const { cache, octokit } = require("../../index.js");
            const { Op } = require("sequelize");

            const level1 = interaction.options.getString("level1");
            const level2 = interaction.options.getString("level2");

            if (
                (await cache.levels.findOne({ where: { filename: level1 } })) ==
                null
            )
                return await interaction.editReply(
                    `:x: Level **${level1}** not found`
                );
            if (
                (await cache.levels.findOne({ where: { filename: level2 } })) ==
                null
            )
                return await interaction.editReply(
                    `:x: Level **${level2}** not found`
                );

            let level1_response, level2_response;
            try {
                level1_response = await octokit.rest.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/${level1}.json`,
                    branch: githubBranch,
                });
            } catch (fetchError) {
                logger.info(`Failed to fetch ${level1}.json: ${fetchError}`);
                return await interaction.editReply(
                    `:x: Failed to fetch data for **${level1}** from github; please try again later`
                );
            }

            try {
                level2_response = await octokit.rest.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/${level2}.json`,
                    branch: githubBranch,
                });
            } catch (fetchError) {
                logger.info(`Failed to fetch ${level2}.json: ${fetchError}`);
                return await interaction.editReply(
                    `:x: Failed to fetch data for **${level2}** from github; please try again later`
                );
            }

            const victors1 = JSON.parse(
                Buffer.from(level1_response.data.content, "base64").toString(
                    "utf-8"
                )
            )?.records;
            const victors2 = JSON.parse(
                Buffer.from(level2_response.data.content, "base64").toString(
                    "utf-8"
                )
            )?.records;

            const mutualVictors = victors1.filter((victor1) =>
                victors2.some((victor2) => victor2.user === victor1.user)
            );
            const mutualVictorNames = await cache.users.findAll({
                where: {
                    user_id: {
                        [Op.in]: mutualVictors.map((victor) => victor.user),
                    },
                },
                attributes: ["name"],
            });

            const mutualVictorNamesString = mutualVictorNames
                .map((victor) => victor.name)
                .join("\n- ");
            const attachment = new AttachmentBuilder(
                Buffer.from("- " + mutualVictorNamesString)
            ).setName(`mutual_victors_${level1}_${level2}.txt`);
            return await interaction.editReply({
                content: `:white_check_mark: Found ${mutualVictorNames.length} mutual victors between **${level1}** and **${level2}**\n`,
                files: [attachment],
            });
        } else if (interaction.options.getSubcommand() === "remove") {
            const { cache, octokit } = require("../../index.js");
            const levelname = await interaction.options.getString("levelname");
            const levelToDelete = await cache.levels.findOne({
                where: { filename: levelname },
            });
            if (!levelToDelete)
                return await interaction.editReply(
                    ":x: Could not find a level with that name, make sure you pick an given option!"
                );

            let list;
            try {
                list = JSON.parse(
                    Buffer.from(
                        (
                            await octokit.rest.repos.getContent({
                                owner: githubOwner,
                                repo: githubRepo,
                                path: githubDataPath + `/_list.json`,
                                branch: githubBranch,
                            })
                        ).data.content,
                        "base64"
                    ).toString("utf-8")
                );
            } catch (e) {
                return await interaction.editReply(
                    `:x: Failed to fetch _list.json: ${e}`
                );
            }
            let fileResponse;
            try {
                fileResponse = await octokit.rest.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/${levelToDelete.filename}.json`,
                    branch: githubBranch,
                });
            } catch (fetchError) {
                logger.info(`Couldn't fetch ${filename}.json: \n${fetchError}`);
                return await interaction.editReply(
                    `:x: Couldn't fetch ${filename}.json: \n${fetchError}`
                );
            }

            let parsedData;
            try {
                parsedData = JSON.parse(
                    Buffer.from(fileResponse.data.content, "base64").toString(
                        "utf-8"
                    )
                );
                parsedData["position"] = levelToDelete.position;
            } catch (parseError) {
                logger.info(
                    `Unable to parse data fetched from ${filename}:\n${parseError}`
                );
                return await interaction.editReply(
                    `:x: Unable to parse data fetched from ${filename}:\n${parseError}`
                );
            }

            const index = list.findIndex(
                (level) => level === levelToDelete.filename
            );

            if (index === -1)
                return await interaction.editReply(
                    ":x: Error removing this level: the filename was not found in _list.json"
                );

            list.splice(index, 1);

            let packs;
            try {
                packs = JSON.parse(
                    Buffer.from(
                        (
                            await octokit.rest.repos.getContent({
                                owner: githubOwner,
                                repo: githubRepo,
                                path: githubDataPath + `/_packs.json`,
                                branch: githubBranch,
                            })
                        ).data.content,
                        "base64"
                    ).toString("utf-8")
                );
            } catch (e) {
                return await interaction.editReply(
                    `:x: Failed to fetch _packs.json: ${e}`
                );
            }

            const filename = levelToDelete.filename;
            const changes = [
                {
                    path: githubDataPath + "/_list.json",
                    content: JSON.stringify(list, null, "\t"),
                },
                {
                    path: githubDataPath + `/archived/${filename}.json`,
                    content: JSON.stringify(parsedData, null, "\t"),
                },
            ];

            const packsWithLevel = packs.filter((pack) =>
                pack.levels?.includes(filename)
            );

            if (packsWithLevel.length > 0) {
                for (const pack of packsWithLevel) {
                    pack.levels = pack.levels.filter(
                        (level) => level !== levelToDelete.filename
                    );
                }
                changes.push({
                    path: githubDataPath + "/_packs.json",
                    content: JSON.stringify(packs, null, "\t"),
                });
            }

            try {
                cache.levels.destroy({
                    where: { filename: levelToDelete.filename },
                });
            } catch (e) {
                return await interaction.editReply(
                    `:x: Error removing level from database: ${e}`
                );
            }

            const toDelete = githubDataPath + `/${filename}.json`;

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
                        mode: change.deleted ? "100644" : "100644",
                        type: change.deleted ? "tree" : "blob",
                        content: change.deleted ? null : change.content || "",
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
                    message: `Update list files...`,
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

            // Get file SHA
            let fileSha;
            try {
                const response = await octokit.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: toDelete,
                });
                fileSha = response.data.sha;
            } catch (error) {
                logger.info(`Error fetching ${toDelete} SHA:\n${error}`);
                return await interaction.editReply(
                    `:x: Couldn't delete ${levelToDelete.name}: ${error} (show this to sphericle!)`
                );
            }

            try {
                await octokit.rest.repos.deleteFile({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: toDelete,
                    message: `... and delete ${levelToDelete.name} (${interaction.user.tag})`,
                    sha: fileSha,
                });
            } catch (e) {
                logger.error(`Error deleting ${toDelete}: \n ${e}`);
                return await interaction.editReply(
                    `:x: Couldn't delete ${levelToDelete.name}: \n${e}\n(show this to sphericle!)`
                );
            }

            try {
                cache.archived.create({
                    filename: filename,
                    name: levelToDelete.name,
                    position: levelToDelete.position,
                });
            } catch (e) {
                return await interaction.editReply(
                    `:x: Error removing level from database: ${e}`
                );
            }
            return await interaction.editReply(
                `:white_check_mark: Removed ${levelToDelete.name}!`
            );
        } else if (interaction.options.getSubcommand() === "restore") {
            const { cache, octokit } = require("../../index.js");

            const levelname = interaction.options.getString("levelname");
            const position = interaction.options.getInteger("position");

            let dbLevel = await cache.archived.findOne({
                where: { filename: levelname },
            });
            if (!dbLevel) {
                return await interaction.editReply(
                    ":x: The level you are trying to restore does not exist in the database"
                );
            }
            const filename = dbLevel.filename;

            let changes = [];
            let fileResponse;
            try {
                fileResponse = await octokit.rest.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/archived/${filename}.json`,
                    branch: githubBranch,
                });
            } catch (fetchError) {
                logger.info(`Couldn't fetch ${filename}.json: \n${fetchError}`);
                return await interaction.editReply(
                    `:x: Couldn't fetch ${filename}.json: \n${fetchError}`
                );
            }

            const parsedData = JSON.parse(
                Buffer.from(fileResponse.data.content, "base64").toString(
                    "utf-8"
                )
            );
            // move the file back to the main folder
            changes.push({
                path: githubDataPath + `/${filename}.json`,
                content: JSON.stringify(parsedData, null, "\t"),
            });

            let list_response;
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

            const list = JSON.parse(
                Buffer.from(list_response.data.content, "base64").toString(
                    "utf-8"
                )
            );
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

            // filter out all levels that are not dividers
            const noDiv = list.filter((level) => !level.startsWith("_"));

            const changelogList = changelog_response
                ? JSON.parse(
                      Buffer.from(
                          changelog_response.data.content,
                          "base64"
                      ).toString("utf-8")
                  )
                : [];

            if (position < 1 || position > list.length + 1) {
                return await interaction.editReply(
                    ":x: The given position is incorrect"
                );
            }

            // get the level below the level we want to place
            // +1 because we want the level above this one in the index
            const levelBelow = noDiv[position + 1];
            logger.log(`Level below: ${levelBelow}`);

            // find the index of that level in the real list
            const realBelow = list.indexOf(levelBelow);

            // insert the level above the real list index
            // -2 because -1 is for indexing and -1 is to put it above levelBelow
            list.splice(realBelow - 2, 0, filename);

            changelogList.push({
                date: Math.floor(new Date().getTime() / 1000),
                action: "placed",
                name: dbLevel.filename,
                to_rank: position,
                from_rank: null,
                above: list[position] || null,
                below: list[position - 2] || null,
            });

            changes.push({
                path: githubDataPath + "/_list.json",
                content: JSON.stringify(list, null, "\t"),
            });

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
                    message: `Placed ${dbLevel.name} at ${position} (${interaction.user.tag})`,
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

            return await interaction.editReply(
                ":white_check_mark: Restored the level!"
            );
        }
    },
};
