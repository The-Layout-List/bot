const { SlashCommandBuilder } = require("discord.js");
const {
    guildId,
    reliableThreadID,
    staffRole,
    submissionsChannelID,
    clientId,
    debug,
    submissionRole,
} = require("../../config.json");
const logger = require("log4js").getLogger();
const Sequelize = require("sequelize");
const isUrlHttp = require("is-url-http");

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("vote")
        .setDescription(
            "Commands to manage your levels submitted to the Layout List."
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("submit")
                .setDescription(
                    "Submit a level to be voted on by the reliable team"
                )
                .addStringOption((option) =>
                    option
                        .setName("levelname")
                        .setDescription("The name of the level to submit")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("verifier")
                        .setDescription("The name of the verifier")
                        .setRequired(true)
                        .setAutocomplete(true)
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
                        .setName("creators")
                        .setDescription(
                            "The list of the creators of the level, each separated by a comma"
                        )
                        .setRequired(true)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("id")
                        .setDescription("The level's ID in Geometry Dash")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("songname")
                        .setDescription(
                            "The name of this level's song. Required if there is a NONG."
                        )
                        .setRequired(true)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("percent")
                        .setDescription(
                            "The minimum percent players need to get a record on this level (list percent)"
                        )
                )
                .addStringOption((option) =>
                    option
                        .setName("password")
                        .setDescription("The GD password of the level to place")
                )
                .addStringOption((option) =>
                    option
                        .setName("raw")
                        .setDescription(
                            "The verifier's raw footage (if the level is extreme+)"
                        )
                )
                .addStringOption((option) =>
                    option
                        .setName("opinion")
                        .setDescription(
                            "Where do you think this level should be placed?"
                        )
                )
                .addIntegerOption((option) =>
                    option
                        .setName("enjoyment")
                        .setDescription(
                            "The verifier's enjoyment rating (1-10) for their list profile."
                        )
                )
                .addAttachmentOption((option) =>
                    option
                        .setName("nong")
                        .setDescription(
                            "The NONG file for this level. You can also paste a link in the song-name field"
                        )
                )
                .addStringOption((option) =>
                    option
                        .setName("note")
                        .setDescription(
                            "Additional notes for staff and people voting to accept/reject this level (note that this is public)"
                        )
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("dm")
                .setDescription("Toggle DMs when someone votes for your level")
                .addIntegerOption((option) =>
                    option
                        .setName("status")
                        .setDescription("Whether to enable or disable DMs")
                        .addChoices(
                            { name: "Enable", value: 1 },
                            { name: "Disable", value: 0 }
                        )
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("status")
                .setDescription("Check the status of a level you submitted")
                .addStringOption((option) =>
                    option
                        .setName("levelname")
                        .setDescription(
                            "The name of the level you want to check"
                        )
                        .setAutocomplete(true)
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("share")
                .setDescription(
                    "Allow another user to see the vote of a level you submitted"
                )
                .addStringOption((option) =>
                    option
                        .setName("levelname")
                        .setDescription(
                            "The name of the level you want to share"
                        )
                        .setAutocomplete(true)
                        .setRequired(true)
                )
                .addUserOption((option) =>
                    option
                        .setName("user")
                        .setDescription(
                            "The user you want to share the level's vote with"
                        )
                        .setRequired(true)
                )
        ),
    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true);
        const { db, cache } = require("../../index.js");
        if (focused.name === "levelname") {
            // if user has staff role, show all levels in voting
            let levels;
            if (await interaction.member.roles.cache.has(staffRole))
                levels = await db.levelsInVoting.findAll();
            else
                levels = await db.levelsInVoting.findAll({
                    where: {
                        shared: Sequelize.where(
                            Sequelize.fn("LOWER", Sequelize.col("shared")),
                            "LIKE",
                            "%" + interaction.user.id + "%"
                        ),
                    },
                });
            return await interaction.respond(
                levels
                    .filter((lvl) =>
                        lvl.levelname
                            .toLowerCase()
                            .includes(focused.value.toLowerCase())
                    )
                    .slice(0, 25)
                    .map((lvl) => ({
                        name: lvl.levelname,
                        value: `${lvl.discordid}`,
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
        }
    },
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "submit") {
            const { db } = require("../../index.js");

            const levelname = interaction.options.getString("levelname");
            const verifier = interaction.options.getString("verifier");
            const verification = interaction.options.getString("verification");
            const creators = interaction.options.getString("creators");
            const id = interaction.options.getInteger("id");
            const songname = interaction.options.getString("songname");
            const percent = interaction.options.getInteger("percent");
            const password = interaction.options.getString("password");
            const raw = interaction.options.getString("raw");
            const opinion = interaction.options.getString("opinion");
            const nong = interaction.options.getAttachment("nong");
            const enjoyment = interaction.options.getInteger("enjoyment");
            const note = interaction.options.getString("note");

            if (enjoyment && (enjoyment > 10 || enjoyment < 1))
                return await interaction.editReply(
                    ":x: that is NOT an enjoyment!!!! (1-10)."
                );

            const hasPerms =
                (await interaction.member.roles.cache.has(submissionRole)) ||
                (await interaction.member.roles.cache.some((role) =>
                    role.name.toLowerCase().startsWith("level")
                ));

            // get the submitter from the db
            let user;
            try {
                user = await db.submitters.findOne({
                    where: {
                        discordid: interaction.user.id,
                    },
                });

                // if this user has never submitted a level
                if (!user) {
                    // if this user is not allowed to submit a level
                    if (!hasPerms) {
                        const capellaPing = "<@1475663205245259776>";

                        return await interaction.editReply(
                            `:x: You do not have permission to submit levels! Chat in the server for a bit and reach Level 2 (\`/rank\` with ${capellaPing}).`
                        );
                    } else {
                        // if they are new but allowed, add the role
                        await interaction.member.roles.add(submissionRole);
                    }

                    const userResult = await db.submitters.create({
                        discordid: interaction.user.id,
                        submissions: 0,
                        dmFlag: false,
                        banned: false,
                    });
                    user = userResult.dataValues;
                }
            } catch (error) {
                logger.error(error);
                return interaction.editReply(
                    `:x: Whoops!!! An error occurred!!! (error trying to find/create db entry: \n${error})`
                );
            }

            if (/\s/g.test(verification) || !isUrlHttp(verification))
                return await interaction.editReply(
                    ":x: The verification link is invalid! Please upload the verification to youtube."
                );

            // check if user has 3 submissions already
            if (user.submissions >= 3 && !debug)
                return interaction.editReply(
                    ":x: You've already submitted 3 levels this month! Please close the GD editor and touch some grass."
                );

            if (user.banned)
                return interaction.editReply(
                    ":x: You've been submission banned! No more funny business."
                );

            const guild = await interaction.client.guilds.fetch(guildId);

            const voteChannel = await guild.channels.cache.get(
                reliableThreadID
            );

            let message =
                `_Submitted by: <@${interaction.user.id}>_\n\nLevel name: ${levelname}\nVerifier: ${verifier}\nVerification: ${verification}\nCreators: ${creators}\nID: \`${id}\`\nSong name: ${songname}` + // man don't askl me why itr needs to be formatted like this ik its ugly bro
                (percent ? `\nList percent: ${percent}%` : "") +
                (password ? `\nPassword: ${password}` : "") +
                (opinion ? `\nDifficulty opinion: ${opinion}` : "") +
                (enjoyment ? `\nVerifier's enjoyment: ${enjoyment}/10` : "") +
                (nong ? `\nNONG: ${nong.url}` : "") +
                (note ? `\n\n_Additional notes: ${note}_` : "");

            const logChannel = await guild.channels.cache.get(
                submissionsChannelID
            );
            await logChannel.send(message);

            if (raw) message += `\nRaw: ${raw}`;

            const thread = await voteChannel.threads.create({
                name: `${levelname} 0-0`,
                autoArchiveDuration: 1440,
                reason: `New level submission by ${interaction.user.tag}`,
                message: message,
            });

            logger.log(`Created thread: ${thread.name}`);

            // increment user's submission count
            const submitter = await db.submitters.findOne({
                where: { discordid: interaction.user.id },
            });
            await submitter.increment("submissions");

            await db.levelsInVoting.create({
                levelname: levelname,
                submitter: interaction.user.id,
                discordid: thread.id,
                yeses: 0,
                nos: 0,
                shared: `${interaction.user.id};`,
                paused: false,
            });

            // i hate this so so so much
            const levelCount = await db.levelStats.findAll();
            await levelCount[0].increment("submissions");

            return interaction.editReply(
                ":white_check_mark: All done! Your level will be voted on by the Reliable team.\nYou can use /vote status to see their progress!"
            );
        } else if (subcommand === "dm") {
            const { db } = require("../../index.js");

            const numStatus = await interaction.options.getInteger("status");

            const status = numStatus === 1 ? true : false;

            let submitter;
            submitter = await db.submitters.findOne({
                where: { discordid: interaction.user.id },
            });

            if (!submitter)
                submitter = await db.submitters.create({
                    discordid: interaction.user.id,
                    submissions: 0,
                    dmFlag: false,
                    banned: false,
                });

            try {
                await db.submitters.update(
                    { dmFlag: status },
                    { where: { discordid: interaction.user.id } }
                );
            } catch (error) {
                logger.error(error);
                return interaction.editReply(
                    `:x: Whoops an error occurred. Please bother zSphericle with this message: ${error}.`
                );
            }

            return interaction.editReply(
                `:white_check_mark: Your DMs have been ${
                    status ? "enabled" : "disabled"
                }!`
            );
        } else if (subcommand === "status") {
            const { db } = require("../../index.js");
            const level = await interaction.options.getString("levelname");

            const hasStaffRole = await interaction.member.roles.cache.has(
                staffRole
            );

            let submission;
            try {
                submission = await db.levelsInVoting.findOne({
                    where: !hasStaffRole
                        ? {
                              discordid: level,
                              shared: Sequelize.where(
                                  Sequelize.fn(
                                      "LOWER",
                                      Sequelize.col("shared")
                                  ),
                                  "LIKE",
                                  "%" + interaction.user.id + "%"
                              ),
                          }
                        : {
                              discordid: level,
                          },
                });
            } catch (error) {
                logger.error(error);
                return await interaction.editReply(
                    `:x: A problem occurred fetching your level info. Please spam sphericle's DMs with this message:\n${error}.`
                );
            }

            if (!submission)
                return await interaction.editReply(
                    ":x: You haven't submitted a level with that name..."
                );

            if (submission.paused === true) {
                return await interaction.editReply(
                    `The vote for _${submission.levelname}_ is currently paused. Please contact a moderator for more info!`
                );
            }

            return await interaction.editReply(
                `The vote for _${submission.levelname}_ is currently **${submission.yeses}-${submission.nos}**.`
            );
        } else if (subcommand === "share") {
            const { db } = require("../../index.js");
            const level = await interaction.options.getString("levelname");
            const user = await interaction.options.getUser("user");

            // if you try to share the vote with yourself, the layout list bot, or any other bot
            if (user.id === interaction.user.id || user.bot) {
                return interaction.editReply(":death: Nice try!");
            }

            if (user.id === clientId) {
                return interaction.editReply(
                    ":death: Bro i did NOT build in this, ts is trash :sob:"
                );
            }

            const hasStaffRole = await interaction.member.roles.cache.has(
                staffRole
            );

            let submission;
            try {
                submission = await db.levelsInVoting.findOne({
                    where: !hasStaffRole
                        ? {
                              discordid: level,
                              submitter: interaction.user.id,
                          }
                        : {
                              discordid: level,
                          },
                });
            } catch (error) {
                logger.error(error);
                return interaction.editReply(
                    ":x: A problem occurred fetching your level info. Please spam sphericle's DMs with this message:\n${error}."
                );
            }

            if (!submission)
                return interaction.editReply(
                    ":x: You have not submitted a level with that name."
                );

            let dbSubmitter = await db.submitters.findOne({
                where: {
                    discordid: user.id,
                },
            });

            if (!dbSubmitter) {
                dbSubmitter = await db.submitters.create({
                    discordid: user.id,
                    submissions: 0,
                    dmFlag: false,
                    banned: false,
                });
            }

            const shared = submission.shared.split(";");
            if (shared.includes(user.id))
                return interaction.editReply(
                    ":x: That user already has access to this level!"
                );

            await db.levelsInVoting.update(
                {
                    shared: `${submission.shared}${user.id};`,
                },
                {
                    where: {
                        discordid: level,
                    },
                }
            );

            return interaction.editReply(
                `Shared _${submission.levelname}_ with ${user.username}!`
            );
        }
    },
};
