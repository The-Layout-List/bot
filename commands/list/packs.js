const { SlashCommandBuilder } = require("discord.js");
const { octokit, cache } = require("../../index.js");
const {
    githubOwner,
    githubRepo,
    githubDataPath,
    githubBranch,
} = require("../../config.json");
const logger = require("log4js").getLogger();

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("pack")
        .setDescription("Command to manage packs on the list")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("create")
                .setDescription("Create a pack")
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
                            { name: "Legendary", value: 7 }
                        )
                        .setDescription(
                            "The tier the level is in (1-10, see the list website for details)"
                        )
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("name")
                        .setDescription(
                            "The name of the pack (leave blank for diff pack)"
                        )
                )
                .addStringOption((option) =>
                    option
                        .setName("level1")
                        .setDescription("The first level in the pack")
                        .setAutocomplete(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("level2")
                        .setDescription("The second level in the pack")
                        .setAutocomplete(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("level3")
                        .setDescription("The third level in the pack")
                        .setAutocomplete(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("level4")
                        .setDescription("The fourth level in the pack")
                        .setAutocomplete(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("level5")
                        .setDescription("The fifth level in the pack")
                        .setAutocomplete(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("remove")
                .setDescription("Remove a pack")
                .addStringOption((option) =>
                    option
                        .setName("pack")
                        .setDescription("The name of the pack to remove")
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("edit")
                .setDescription("Edit a pack's info (not including levels)")
                .addStringOption((option) =>
                    option
                        .setName("pack")
                        .setDescription("The pack you want to edit")
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("newname")
                        .setDescription("The new name of the pack")
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
                            { name: "Legendary", value: 7 }
                        )
                        .setDescription(
                            "The tier the level is in (1-10, see the list website for details)"
                        )
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("addlevel")
                .setDescription("Add a level to a pack")
                .addStringOption((option) =>
                    option
                        .setName("pack")
                        .setDescription("The name of the pack")
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("level")
                        .setDescription("The level to add")
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("removelevel")
                .setDescription("Remove a level from a pack")
                .addStringOption((option) =>
                    option
                        .setName("pack")
                        .setDescription("The name of the pack")
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("level")
                        .setDescription("The level to add")
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        ),
    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true);
        const Sequelize = require("sequelize");

        if (focused.name.startsWith("level")) {
            let levels = await cache.levels.findAll({
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
        } else if (focused.name === "pack") {
            let packs = await cache.packs.findAll({
                where: {
                    name: Sequelize.where(
                        Sequelize.fn("LOWER", Sequelize.col("name")),
                        "LIKE",
                        "%" + focused.value.toLowerCase() + "%"
                    ),
                },
            });
            return await interaction.respond(
                packs
                    .slice(0, 25)
                    .map((pack) => ({ name: pack.name, value: pack.name }))
            );
        }
    },
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "create") {
            const difficulty = interaction.options.getInteger("difficulty");
            let name;
            if (interaction.options.getString("name")) {
                name = interaction.options.getString("name");
            } else {
                switch (difficulty) {
                    case 0:
                        name = "Beginner Pack";
                        break;
                    case 1:
                        name = "Easy Pack";
                        break;
                    case 2:
                        name = "Medium Pack";
                        break;
                    case 3:
                        name = "Hard Pack";
                        break;
                    case 4:
                        name = "Insane Pack";
                        break;
                    case 5:
                        name = "Mythical Pack";
                        break;
                    case 6:
                        name = "Extreme Pack";
                        break;
                    case 7:
                        name = "Supreme Pack";
                        break;
                    case 8:
                        name = "Ethereal Pack";
                        break;
                    case 9:
                        name = "Legendary Pack";
                        break;
                    case 10:
                        name = "Silent Pack";
                        break;
                    case 11:
                        name = "Impossible Pack";
                        break;
                    case 12:
                        name = "Unfathomable Pack";
                        break;
                }
            }
            const level1 = interaction.options.getString("level1") || null;
            const level2 = interaction.options.getString("level2") || null;
            const level3 = interaction.options.getString("level3") || null;
            const level4 = interaction.options.getString("level4") || null;
            const level5 = interaction.options.getString("level5") || null;

            logger.log(`creating pack ${name}`);
            const pack = {
                name: name,
                difficulty: difficulty,
                levels: [],
            };
            // sigh
            if (level1) pack.levels.push(level1);
            if (level2) pack.levels.push(level2);
            if (level3) pack.levels.push(level3);
            if (level4) pack.levels.push(level4);
            if (level5) pack.levels.push(level5);

            // fetch github data path / _packs.json
            let fileResponse;
            try {
                fileResponse = await octokit.rest.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/_packs.json`,
                    branch: githubBranch,
                });
            } catch (fetchError) {
                logger.info(`Couldn't fetch flags.json: \n${fetchError}`);
                return await interaction.editReply(
                    `:x: Couldn't fetch flags.json: \n${fetchError}`
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
                logger.info(`Unable to parse flags data:\n${parseError}`);
                return await interaction.editReply(
                    `:x: Unable to parse flags data:\n${parseError}`
                );
            }

            if (parsedData.some((pack) => pack.name === name))
                return await interaction.editReply(
                    `:x: A pack with the name ${name} already exists!`
                );

            // add pack to top of array
            parsedData.unshift(pack);

            // commit
            let fileSha;
            try {
                const response = await octokit.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/_packs.json`,
                });
                fileSha = response.data.sha;
            } catch (error) {
                logger.info(`Error fetching _packs.json SHA:\n${error}`);
                return await interaction.editReply(
                    `:x: Couldn't fetch data from _packs.json`
                );
            }
            try {
                await octokit.repos.createOrUpdateFileContents({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/_packs.json`,
                    branch: githubBranch,
                    message: `Added ${name} to _packs.json`,
                    content: Buffer.from(
                        JSON.stringify(parsedData, null, "\t")
                    ).toString("base64"),
                    sha: fileSha,
                });
            } catch (updateError) {
                logger.info(`Couldn't update flags.json: \n${updateError}`);
                return await interaction.editReply(
                    `:x: Couldn't update flags.json: \n${updateError}`
                );
            }

            // add pack to cache
            await cache.packs.create({
                name: name,
                difficulty: difficulty,
                isDiff: pack.levels && pack.levels.length > 0 ? false : true,
            });

            return await interaction.editReply(
                ":white_check_mark: Pack created successfully!"
            );
        } else if (subcommand === "remove") {
            const pack = interaction.options.getString("pack");

            // fetch github data path / _packs.json
            let fileResponse;
            try {
                fileResponse = await octokit.rest.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/_packs.json`,
                    branch: githubBranch,
                });
            } catch (fetchError) {
                logger.info(`Couldn't fetch flags.json: \n${fetchError}`);
                return await interaction.editReply(
                    `:x: Couldn't fetch flags.json: \n${fetchError}`
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
                logger.info(`Unable to parse flags data:\n${parseError}`);
                return await interaction.editReply(
                    `:x: Unable to parse flags data:\n${parseError}`
                );
            }

            const packIndex = parsedData.findIndex(
                (foundPack) => foundPack.name === pack
            );

            if (packIndex === -1)
                return await interaction.editReply(
                    `:x: A pack with the name ${pack} doesn't exist!`
                );

            parsedData.splice(packIndex, 1);

            // commit
            let fileSha;
            try {
                const response = await octokit.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/_packs.json`,
                });
                fileSha = response.data.sha;
            } catch (error) {
                logger.info(`Error fetching _packs.json SHA:\n${error}`);
                return await interaction.editReply(
                    `:x: Couldn't fetch data from _packs.json`
                );
            }
            try {
                await octokit.repos.createOrUpdateFileContents({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/_packs.json`,
                    branch: githubBranch,
                    message: `Removed ${pack} from _packs.json`,
                    content: Buffer.from(
                        JSON.stringify(parsedData, null, "\t")
                    ).toString("base64"),
                    sha: fileSha,
                });
            } catch (updateError) {
                logger.info(`Couldn't update flags.json: \n${updateError}`);
                return await interaction.editReply(
                    `:x: Couldn't update flags.json: \n${updateError}`
                );
            }
            cache.packs.destroy({ where: { name: pack } });
            return await interaction.editReply(
                ":white_check_mark: Pack removed successfully!"
            );
        } else if (subcommand === "edit") {
            const pack = interaction.options.getString("pack") || null;
            const newName = interaction.options.getString("newname") || null;
            const newDifficulty =
                interaction.options.getInteger("difficulty") || null;

            // fetch github data path / _packs.json
            let fileResponse;
            try {
                fileResponse = await octokit.rest.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/_packs.json`,
                    branch: githubBranch,
                });
            } catch (fetchError) {
                logger.info(`Couldn't fetch flags.json: \n${fetchError}`);
                return await interaction.editReply(
                    `:x: Couldn't fetch flags.json: \n${fetchError}`
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
                logger.info(`Unable to parse flags data:\n${parseError}`);
                return await interaction.editReply(
                    `:x: Unable to parse flags data:\n${parseError}`
                );
            }

            const packIndex = parsedData.findIndex(
                (foundPack) => foundPack.name === pack
            );

            if (packIndex === -1)
                return await interaction.editReply(":x: Pack not found");

            // adding/removing levels will be done separately
            if (newName) parsedData[packIndex].name = newName;
            if (newDifficulty) parsedData[packIndex].difficulty = newDifficulty;

            // commit
            let fileSha;
            try {
                const response = await octokit.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/_packs.json`,
                });
                fileSha = response.data.sha;
            } catch (error) {
                logger.info(`Error fetching _packs.json SHA:\n${error}`);
                return await interaction.editReply(
                    `:x: Couldn't fetch data from _packs.json`
                );
            }
            try {
                await octokit.repos.createOrUpdateFileContents({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/_packs.json`,
                    branch: githubBranch,
                    message: `Updated ${parsedData[packIndex].name}`,
                    content: Buffer.from(
                        JSON.stringify(parsedData, null, "\t")
                    ).toString("base64"),
                    sha: fileSha,
                });
            } catch (updateError) {
                logger.info(`Couldn't update flags.json: \n${updateError}`);
                return await interaction.editReply(
                    `:x: Couldn't update flags.json: \n${updateError}`
                );
            }

            cache.packs.update(
                {
                    name: newName,
                    difficulty: newDifficulty,
                },
                { where: { name: pack } }
            );

            return await interaction.editReply(
                `:white_check_mark: Edited ${pack}!`
            );
        } else if (subcommand === "addlevel") {
            const packName = interaction.options.getString("pack") || null;
            const levelName = interaction.options.getString("level") || null;

            const pack = await cache.packs.findOne({
                where: { name: packName },
            });

            if (!pack)
                return await interaction.editReply(
                    ":x: This pack doesn't exist!"
                );

            const level = await cache.levels.findOne({
                where: { filename: levelName },
            });

            if (!level)
                return await interaction.editReply(
                    ":x: That level doesn't exist!"
                );

            // fetch github data path / _packs.json
            let fileResponse;
            try {
                fileResponse = await octokit.rest.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/_packs.json`,
                    branch: githubBranch,
                });
            } catch (fetchError) {
                logger.info(`Couldn't fetch flags.json: \n${fetchError}`);
                return await interaction.editReply(
                    `:x: Couldn't fetch flags.json: \n${fetchError}`
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
                logger.info(`Unable to parse flags data:\n${parseError}`);
                return await interaction.editReply(
                    `:x: Unable to parse flags data:\n${parseError}`
                );
            }

            const packIndex = parsedData.findIndex(
                (foundPack) => foundPack.name === pack.name
            );

            parsedData[packIndex].levels.push(level.filename);

            // commit
            let fileSha;
            try {
                const response = await octokit.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/_packs.json`,
                });
                fileSha = response.data.sha;
            } catch (error) {
                logger.info(`Error fetching _packs.json SHA:\n${error}`);
                return await interaction.editReply(
                    `:x: Couldn't fetch data from _packs.json`
                );
            }
            try {
                await octokit.repos.createOrUpdateFileContents({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/_packs.json`,
                    branch: githubBranch,
                    message: `Added ${level.name} to ${parsedData[packIndex].name}`,
                    content: Buffer.from(
                        JSON.stringify(parsedData, null, "\t")
                    ).toString("base64"),
                    sha: fileSha,
                });
            } catch (updateError) {
                logger.info(`Couldn't update flags.json: \n${updateError}`);
                return await interaction.editReply(
                    `:x: Couldn't update flags.json: \n${updateError}`
                );
            }

            return await interaction.editReply(
                `:white_check_mark: Added ${level.name} to ${pack.name}!`
            );
        } else if (subcommand === "removelevel") {
            const packName = interaction.options.getString("pack") || null;
            const levelName = interaction.options.getString("level") || null;

            const pack = await cache.packs.findOne({
                where: { name: packName },
            });

            if (!pack)
                return await interaction.editReply(
                    ":x: This pack doesn't exist!"
                );

            const level = await cache.levels.findOne({
                where: { filename: levelName },
            });

            if (!level)
                return await interaction.editReply(
                    ":x: That level doesn't exist!"
                );

            // fetch github data path / _packs.json
            let fileResponse;
            try {
                fileResponse = await octokit.rest.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/_packs.json`,
                    branch: githubBranch,
                });
            } catch (fetchError) {
                logger.info(`Couldn't fetch flags.json: \n${fetchError}`);
                return await interaction.editReply(
                    `:x: Couldn't fetch flags.json: \n${fetchError}`
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
                logger.info(`Unable to parse flags data:\n${parseError}`);
                return await interaction.editReply(
                    `:x: Unable to parse flags data:\n${parseError}`
                );
            }

            const packIndex = parsedData.findIndex(
                (foundPack) => foundPack.name === pack.name
            );

            const levelIndex = parsedData[packIndex].levels.indexOf(
                level.filename
            );

            if (levelIndex > -1) {
                parsedData[packIndex].levels.splice(levelIndex, 1);
            } else {
                return await interaction.editReply(
                    `:x: Could not find ${level.name} in ${pack.name}`
                );
            }

            // commit
            let fileSha;
            try {
                const response = await octokit.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/_packs.json`,
                });
                fileSha = response.data.sha;
            } catch (error) {
                logger.info(`Error fetching _packs.json SHA:\n${error}`);
                return await interaction.editReply(
                    `:x: Couldn't fetch data from _packs.json`
                );
            }
            try {
                await octokit.repos.createOrUpdateFileContents({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/_packs.json`,
                    branch: githubBranch,
                    message: `Removed ${level.name} from ${parsedData[packIndex].name}`,
                    content: Buffer.from(
                        JSON.stringify(parsedData, null, "\t")
                    ).toString("base64"),
                    sha: fileSha,
                });
            } catch (updateError) {
                logger.info(`Couldn't update _packs.json: \n${updateError}`);
                return await interaction.editReply(
                    `:x: Couldn't update _packs.json: \n${updateError}`
                );
            }

            return await interaction.editReply(
                `:white_check_mark: Removed ${level.name} from ${pack.name}!`
            );
        }
    },
};
