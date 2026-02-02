const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { guildId, debug } = require("../../config.json");
const logger = require("log4js").getLogger();
const updateLevels = require("../../scheduled/updateLevels.js");

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("votemod")
        .setDescription("Moderator commands for levels in voting")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("set")
                .setDescription("Update the information of a level in voting")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("debugclear")
                .setDescription("Don't run this pls")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("ban")
                .setDescription("Submission ban a user")
                .addUserOption((option) =>
                    option
                        .setName("submitter")
                        .setDescription("The user to ban from submitting")
                        .setRequired(true)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("unban")
                        .setDescription("Whether to unban this user")
                        .addChoices(
                            { name: "Yes", value: 1 },
                            { name: "No", value: 0 }
                        )
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("insert")
                .setDescription(
                    "Start a new voting (debug, for if this thread wasn't created by the bot)"
                )
                .addUserOption((option) =>
                    option
                        .setName("submitter")
                        .setDescription("The name of the user to insert")
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("stats")
                .setDescription("Display monthly stats for list submissions.")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("sync")
                .setDescription("Manually update the data for submitted levels")
        ),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        if (interaction.options.getSubcommand() === "setsubmissions") {
            const { db } = require("../../index.js");

            const cmdUser = interaction.options.getString("user");
            const count = interaction.options.getInteger("submissions");

            // set submissions to 0
            try {
                await db.submitters.update(
                    { submissions: count || 0 },
                    { where: cmdUser ? { discordid: cmdUser } : {} }
                );
            } catch (error) {
                logger.info(`Failed to reset submissions: ${error}`);
                return await interaction.editReply(
                    ":x: Something went wrong while resetting the submissions; please try again later"
                );
            }

            return await interaction.editReply(
                ":white_check_mark: Submissions have been reset"
            );
        } else if (interaction.options.getSubcommand() === "debugclear") {
            const { db } = require("../../index.js");

            if (!debug) return await interaction.reply("Nope!");
            try {
                await db.levelsInVoting.destroy({ where: {} });
                await db.submitters.destroy({ where: {} });
            } catch (error) {
                logger.error(error);
                return interaction.editReply(
                    ":x: An error occurred while clearing the levels in voting. Please try again later."
                );
            }

            return interaction.editReply(":white_check_mark: Levels cleared!");
        } else if (interaction.options.getSubcommand() === "insert") {
            const { db } = require("../../index.js");

            const text = await interaction.channel.name;
            const matchLevelName = text.match(/^(.*)\s\d+-\d+$/);
            const user = await interaction.options.getUser("submitter");
            const matchYes = text.match(/(\d+)-\d+$/);
            const matchNo = text.match(/\d+-(\d+)$/);

            let submitter;
            submitter = await db.submitters.findOne({
                where: { discordid: user.id },
            });
            if (!submitter) {
                // create submitter
                submitter = await db.submitters.create({
                    discordid: user.id,
                    submissions: 0,
                    dmFlag: false,
                    banned: false,
                }).dataValues;
            }

            await db.levelsInVoting.create({
                levelname: matchLevelName[1],
                submitter: user.id,
                discordid: interaction.channel.id,
                yeses: matchYes[1],
                nos: matchNo[1],
                shared: `${submitter.discordid};`,
                paused: false,
            });
            interaction.editReply(":white_check_mark: Vote inserted!");
        } else if (interaction.options.getSubcommand() === "set") {
            const { db } = require("../../index.js");

            const text = await interaction.channel.name;
            const matchLevelName = text.match(/^(.*)\s\d+-\d+$/);
            const matchYes = text.match(/(\d+)-\d+$/);
            const matchNo = text.match(/\d+-(\d+)$/);

            const level = await db.levelsInVoting.findOne({
                where: { discordid: interaction.channel.id },
            });

            if (!level)
                return await interaction.editReply(":x: level not found");

            db.levelsInVoting.update(
                {
                    levelname: matchLevelName[1],
                    yeses: matchYes[1],
                    nos: matchNo[1],
                },
                {
                    where: {
                        discordid: interaction.channel.id,
                    },
                }
            );
        } else if (interaction.options.getSubcommand() === "submitban") {
            const { db } = require("../../index.js");
            const user = await interaction.options.getUser("submitter");
            const unban = await interaction.options.getInteger("unban");
            if (unban === 1) {
                await db.submitters.update(
                    {
                        banned: false,
                    },
                    {
                        where: {
                            discordid: user.id,
                        },
                    }
                );
                return await interaction.editReply(
                    "The user has been unbanned"
                );
            }
            await db.submitters.update(
                {
                    banned: true,
                },
                {
                    where: {
                        discordid: user.id,
                    },
                }
            );

            const guild = await interaction.client.guilds.fetch(guildId);

            const levels = await db.levelsInVoting.findAll({
                where: { submitter: user.id },
            });

            levels.forEach(async (level) => {
                const channel = await guild.channels.cache.get(level.discordid);

                await channel.send(
                    `:x: The submitter of this level has been submission banned, rejecting...`
                );

                await channel.setName(`${level.levelname} (REJECTED)`);

                await channel.setLocked(true);
                await channel.setArchived(true);
                
            });

            await db.levelsInVoting.destroy({
                where: { submitter: user.id },
            });

            return await interaction.editReply(
                ":x: This user has been banned!"
            );
        } else if (interaction.options.getSubcommand() === "stats") {
            const { db } = require("../../index.js");

            // i blame sequelize
            let dbInfo = await db.levelStats.findAll();
            let modInfo = dbInfo[0];

            const modInfoEmbed = new EmbedBuilder()
                .setColor(0xffbf00)
                .setTitle("Monthly submission info")
                .addFields(
                    {
                        name: "Total submissions:",
                        value: `${modInfo.submissions}`,
                        inline: true,
                    },
                    {
                        name: "Accepted levels:",
                        value: `${modInfo.accepts}`,
                        inline: true,
                    },
                    {
                        name: "Denied levels:",
                        value: `${modInfo.denies}`,
                        inline: true,
                    }
                );

            return await interaction.editReply({
                embeds: [modInfoEmbed],
            });
        } else if (interaction.options.getSubcommand() === "sync") {
            await updateLevels.execute();
            return await interaction.editReply(":white_check_mark:");
        }
    },
};
