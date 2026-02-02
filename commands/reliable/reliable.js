const {
    SlashCommandBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    AttachmentBuilder,
    MessageFlags,
} = require("discord.js");
const logger = require("log4js").getLogger();
const Sequelize = require("sequelize");
const { submissionResultsID, guildId } = require("../../config.json");

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("reliable")
        .setDescription("Staff list management")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("yes")
                .setDescription("Add a yes vote to a level")
        )
        .addSubcommand((subcommand) =>
            subcommand.setName("no").setDescription("Add a no vote to a level")
        )
        .addSubcommand((subcommand) =>
            subcommand.setName("accept").setDescription("Accept a level")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("reject")
                .setDescription("Reject a level")
                .addStringOption((option) =>
                    option
                        .setName("reason")
                        .setDescription("The reason for rejecting the level")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("images")
                        .setDescription(
                            "Links to images to send along with the rejection message (used so the images embed)"
                        )
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("pause")
                .setDescription("Set a level's status to paused")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("reset")
                .setDescription("Reset a level's votes to 0-0")
        ),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        if (interaction.options.getSubcommand() === "yes") {
            const { db } = require("../../index.js");
            // if the current channel is not a thread
            if (!(await interaction.channel.isThread())) {
                return await interaction.editReply(
                    "Bro lock in this isnt a reliable thread"
                );
            }

            let dbEntry = await db.levelsInVoting.findOne({
                where: { discordid: interaction.channel.id },
            });

            if (dbEntry.paused) {
                return await interaction.editReply(
                    "This thread is paused, you can't vote on it!"
                );
            }

            await interaction.editReply("Checking thread name...");
            try {
                await interaction.editReply({
                    content: "Changing thread name, this could take a while...",
                    flags: MessageFlags.Ephemeral,
                });

                // get last 10 messages in channel
                const messages = await interaction.channel.messages.fetch({
                    limit: 10,
                });

                // find the most recent message that contains "vote: "
                const voteMessage = messages.find((msg) =>
                    msg.content.toLowerCase().includes("vote:")
                );

                // pin the message
                if (voteMessage) await voteMessage.pin();

                const message = await interaction.channel.send(
                    `The vote is now at **${dbEntry.yeses + 1}-${
                        dbEntry.nos
                    }**. The thread name is being updated!!`
                );

                await interaction.channel.setName(
                    `${dbEntry.levelname} ${dbEntry.yeses + 1}-${dbEntry.nos}`,
                    `Vote added by ${interaction.user.username}`
                ); // Set the channel name to the same thing but with the added yes

                await message.delete();

                // update entry in db
                await db.levelsInVoting.update(
                    { yeses: dbEntry.yeses + 1 },
                    { where: { discordid: await interaction.channel.id } }
                );

                dbEntry = await db.levelsInVoting.findOne({
                    where: { discordid: await interaction.channel.id },
                });

                const entry = dbEntry.dataValues;

                let shared = entry.shared.split(";");
                shared.pop();

                for (const user of shared) {
                    const submitterDb = await db.submitters.findOne({
                        where: {
                            discordid: Sequelize.where(
                                Sequelize.fn(
                                    "LOWER",
                                    Sequelize.col("discordid")
                                ),
                                "LIKE",
                                "%" + user + "%"
                            ),
                        },
                    });

                    // check if the user has dmFlag set to true
                    if (submitterDb.dataValues.dmFlag) {
                        // get user by id of entry.submitter
                        const submitter = await interaction.guild.members.fetch(
                            entry.submitter
                        );
                        await submitter.send(
                            `The level _${dbEntry.levelname}_ has received a new yes vote!\nThe vote is now at **${dbEntry.yeses}-${dbEntry.nos}**.\n-# _To disable these messages, use the \`/vote dm\` command._`
                        );
                    }
                }
            } catch (e) {
                logger.error(`Error: ${e}`);
                return await interaction.editReply(
                    `Something went wrong: ${e}`
                );
            }

            return await interaction.editReply("Updated!");
        } else if (interaction.options.getSubcommand() === "no") {
            const { db } = require("../../index.js");
            await interaction.editReply("Checking thread name...");
            // if the current channel is not a thread
            if (!interaction.channel.isThread()) {
                return await interaction.editReply(
                    "Bro lock in this isnt a reliable thread"
                );
            }

            let dbEntry = await db.levelsInVoting.findOne({
                where: { discordid: interaction.channel.id },
            });

            if (dbEntry.paused) {
                return await interaction.editReply(
                    "This thread is paused, you can't vote on it!"
                );
            }

            try {
                await interaction.editReply({
                    content: "Changing thread name, this could take a while...",
                    flags: MessageFlags.Ephemeral,
                });

                // get last 10 messages in channel
                const messages = await interaction.channel.messages.fetch({
                    limit: 10,
                });

                // find the most recent message that contains "vote: "
                const voteMessage = messages.find((msg) =>
                    msg.content.toLowerCase().includes("vote:")
                );

                // pin the message
                if (voteMessage) await voteMessage.pin();

                const message = await interaction.channel.send(
                    `The vote is now at **${dbEntry.yeses}-${
                        dbEntry.nos + 1
                    }**.`
                );

                await interaction.channel.setName(
                    `${dbEntry.levelname} ${dbEntry.yeses}-${dbEntry.nos + 1}`,
                    `Vote added by ${interaction.user.username}`
                ); // Set the channel name to the same thing but with the added no

                await message.delete();

                // update entry in db
                await db.levelsInVoting.update(
                    { nos: dbEntry.nos + 1 },
                    { where: { discordid: await interaction.channel.id } }
                );

                dbEntry = await db.levelsInVoting.findOne({
                    where: { discordid: await interaction.channel.id },
                });

                const entry = dbEntry.dataValues;

                let shared = entry.shared.split(";");
                shared.pop();

                for (const user of shared) {
                    const submitterDb = await db.submitters.findOne({
                        where: {
                            discordid: Sequelize.where(
                                Sequelize.fn(
                                    "LOWER",
                                    Sequelize.col("discordid")
                                ),
                                "LIKE",
                                "%" + user + "%"
                            ),
                        },
                    });

                    // check if the user has dmFlag set to true
                    if (submitterDb.dmFlag) {
                        // get user by id of entry.submitter
                        const submitter = await interaction.guild.members.fetch(
                            entry.submitter
                        );
                        await submitter.send(
                            `The level _${dbEntry.levelname}_ has received a no vote...\nThe vote is now at **${dbEntry.yeses}-${dbEntry.nos}**.\n-# _To disable these messages, use the \`/vote dm\` command._`
                        );
                    }
                }
            } catch (e) {
                logger.error(`Error: ${e}`);
                return await interaction.editReply(
                    `Something went wrong: ${e}`
                );
            }

            // ping user if needed
            return await interaction.editReply("Updated!");
        } else if (
            interaction.options.getSubcommand() === "accept" ||
            interaction.options.getSubcommand() === "reject"
        ) {
            const guild = await interaction.client.guilds.fetch(guildId);
            const { db } = require("../../index.js");

            const command = interaction.options.getSubcommand();
            const submissionsChannel = guild.channels.cache.get(
                `${submissionResultsID}`
            );

            const submission = await db.levelsInVoting.findOne({
                where: { discordid: interaction.channel.id },
            });

            // if the current channel is not a thread
            if (!interaction.channel.isThread()) {
                return await interaction.editReply(
                    "Bro lock in this isnt a reliable thread"
                );
            }
            await interaction.editReply("Fetching thread info...");

            const embed = new EmbedBuilder()
                .setTitle(
                    command === "accept"
                        ? `Accepted: ${submission.levelname}`
                        : `Rejected: ${submission.levelname}`
                )
                .setColor(command === "accept" ? 0x00ff00 : 0xff0000)
                .setTimestamp();

            if (command === "reject")
                embed.setDescription(
                    `Reason: ${interaction.options.getString("reason")}`
                );
            await interaction.editReply("Sending message...");
            const shared = submission.shared.split(";");
            shared.pop();
            let pingMessage = "";
            for (const user of shared) pingMessage += `<@${user}> `;
            // add links to message
            const rawImgs = interaction.options.getString("images");
            let attachments = [];
            if (rawImgs) {
                const imgs = rawImgs.split(",");
                for (const img of imgs) {
                    const attachment = new AttachmentBuilder(img.trim());
                    attachments.push(attachment);
                }
            }

            const submissionMessage = await submissionsChannel.send({
                embeds: [embed],
                content: pingMessage,
                files: attachments,
            });

            await submissionMessage.react("👍");
            await submissionMessage.react("👎");

            // i hate this so so so much
            const levelCount = await db.levelStats.findAll();

            await levelCount[0].increment(
                command === "accept" ? "accepts" : "denies"
            );

            await interaction.editReply({
                content: "Updating thread name...",
                flags: MessageFlags.Ephemeral,
            });

            const message = await interaction.channel.send(
                `This level has been ${
                    command === "accept" ? "accepted" : "rejected"
                }.`
            );

            await interaction.channel.setName(
                `${submission.levelname} (${
                    command === "accept" ? "ACCEPTED" : "REJECTED"
                })`,
                `${command === "accept" ? "Accepted" : "Rejected"} by ${
                    interaction.user.username
                }`
            ); // Set the channel name to the same thing but with the added yes

            await message.delete();

            // Create button to delete the thread
            const deleteThread = new ButtonBuilder()
                .setCustomId("deleteThread")
                .setLabel("Delete Thread")
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(deleteThread);

            await interaction.editReply({
                content: "The thread has been updated!",
                components: command === "reject" ? [row] : [],
                flags: MessageFlags.Ephemeral,
            });
            if (command === "reject") {
                interaction.channel.setLocked(true);
                interaction.channel.setArchived(true);
            }

            await db.levelsInVoting.destroy({
                where: { discordid: interaction.channel.id },
            });

            return;
        } else if (interaction.options.getSubcommand() === "pause") {
            const { db } = require("../../index.js");
            // if the current channel is not a thread
            if (!interaction.channel.isThread()) {
                return await interaction.editReply(
                    "Bro lock in this isnt a reliable thread"
                );
            }

            const dbEntry = await db.levelsInVoting.findOne({
                where: { discordid: interaction.channel.id },
            });

            if (!dbEntry)
                return await interaction.editReply(
                    ":x: Couldn't find the level in the database!"
                );

            await interaction.editReply({
                content: "Changing thread name, this could take a while...",
                flags: MessageFlags.Ephemeral,
            });

            const message = await interaction.channel.send(
                `This level has been ` +
                    (dbEntry.paused ? "unpaused." : "paused.")
            );

            await interaction.channel.setName(
                `${dbEntry.levelname} ` +
                    (dbEntry.paused
                        ? `${dbEntry.yeses}-${dbEntry.nos}`
                        : `(PAUSED)`),
                `Paused by ${interaction.user.username}`
            ); // Set the channel name to the same thing but with pause

            await message.delete();

            // update entry in db
            await db.levelsInVoting.update(
                { paused: !dbEntry.paused },
                { where: { discordid: interaction.channel.id } }
            );

            await interaction.editReply(
                "The thread has been " +
                    (dbEntry.paused ? "unpaused!" : "paused!")
            );

            const entry = dbEntry.dataValues;

            let shared = entry.shared.split(";");
            shared.pop();

            for (const user of shared) {
                const submitterDb = await db.submitters.findOne({
                    where: {
                        discordid: Sequelize.where(
                            Sequelize.fn("LOWER", Sequelize.col("discordid")),
                            "LIKE",
                            "%" + user + "%"
                        ),
                    },
                });

                if (!submitterDb.dmFlag) continue;
                // get user by id of entry.submitter
                const submitter = await interaction.guild.members.fetch(
                    entry.submitter
                );
                await submitter.send(
                    `Voting for the level _${dbEntry.levelname}_ has been ` +
                        (dbEntry.paused
                            ? `unpaused. `
                            : `paused. Please DM a mod for more info!`) +
                        `\n-# _To disable these messages, use the \`/vote dm\` command._`
                );
            }
        } else if (interaction.options.getSubcommand() === "reset") {
            const { db } = require("../../index.js");
            // if the current channel is not a thread
            if (!interaction.channel.isThread()) {
                return await interaction.editReply(
                    "Bro lock in this isnt a reliable thread"
                );
            }

            const dbEntry = await db.levelsInVoting.findOne({
                where: { discordid: interaction.channel.id },
            });

            if (!dbEntry)
                return await interaction.editReply(
                    ":x: Couldn't find the level in the database!"
                );

            await interaction.editReply({
                content: "Changing thread name, this could take a while...",
                flags: MessageFlags.Ephemeral,
            });

            const message = await interaction.channel.send(
                `The vote has been reset to 0-0.`
            );

            await interaction.channel.setName(
                `${dbEntry.levelname} 0-0`,
                `Reset by ${interaction.user.username}`
            ); // Set the channel name to the same thing but with the added pause

            await message.delete();

            // update entry in db
            await db.levelsInVoting.update(
                { yeses: 0, nos: 0 },
                { where: { discordid: interaction.channel.id } }
            );

            await interaction.editReply("The vote has been reset to 0-0!");

            const entry = dbEntry.dataValues;

            let shared = entry.shared.split(";");
            shared.pop();

            for (const user of shared) {
                const submitterDb = await db.submitters.findOne({
                    where: {
                        discordid: Sequelize.where(
                            Sequelize.fn("LOWER", Sequelize.col("discordid")),
                            "LIKE",
                            "%" + user + "%"
                        ),
                    },
                });

                if (!submitterDb.dmFlag) continue;
                // get user by id of entry.submitter
                const submitter = await interaction.guild.members.fetch(
                    entry.submitter
                );
                await submitter.send(
                    `The vote for the level _${dbEntry.levelname}_ has been reset to 0-0.\n-# _To disable these messages, use the \`/vote dm\` command._`
                );
            }
        }
    },
};
