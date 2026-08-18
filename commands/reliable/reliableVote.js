const {
    ContextMenuCommandBuilder,
    ApplicationCommandType,
    MessageFlags,
    ContextMenuCommandInteraction,
} = require("discord.js");
const Sequelize = require("sequelize");
const logger = require("log4js").getLogger();
const { startingPointsCount, pointsIncrement, maxPointsCount } = require("../../config.json")

module.exports = {
    enabled: true,
    data: new ContextMenuCommandBuilder()
        .setName("Vote yes")
        .setType(ApplicationCommandType.Message),
    /**
     * 
     * @param {ContextMenuCommandInteraction} interaction 
     * @returns 
     */
    async execute(interaction) {
        const voteMessage = await interaction.channel.messages.fetch(
            interaction.targetId
        ).catch((err) => {
            logger.error(`Error fetching message: ${err}`);
            return;
        });
        if (!voteMessage) {
            return await interaction.editReply(
                "Could not fetch the target message."
            );
        }

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

            dbEntry.yeses = dbEntry.yeses + 1;
            await dbEntry.save();

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

        const [reliableProfile, _created] = await db.reliableProfile.findOrCreate({
            where: { discordid: voteMessage.author.id },
            defaults: {
                points: startingPointsCount,
                totalPoints: startingPointsCount,
                lastVote: new Date(),
                lastPointReset: null,
                totalYeses: 0,
                totalNos: 0,
            }
        })

        reliableProfile.update({
            points: Math.min(reliableProfile.points + pointsIncrement, maxPointsCount),
            totalPoints: reliableProfile.totalPoints + pointsIncrement,
            totalYeses: reliableProfile.totalYeses + 1,
            lastVote: new Date(),
        })

        return await interaction.editReply("Updated!");


    },
};
