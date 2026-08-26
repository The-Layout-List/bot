const { SlashCommandBuilder } = require("discord.js");
const { feedbackBanID, maxSkipCount, guildId } = require("../../config.json");
const logger = require("log4js").getLogger();

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("skip")
        .setDescription("Command to manage counting skip counts in feedback")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("add")
                .setDescription("Increase the count")
                .addStringOption((option) =>
                    option
                        .setName("user")
                        .setDescription("The discord user")
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("remove")
                .setDescription("Decrease the count")
                .addStringOption((option) =>
                    option
                        .setName("user")
                        .setDescription("The discord user")
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        ),
    async autocomplete(interaction) {
        // TODO: use less db queries
        const { db } = require("../../index.js");
        const focused = interaction.options.getFocused(true);
        const members = interaction.guilds.cache.get(guildId).members.cache;
        let filtered = await members.filter((member) =>
            member.user.username
                .toLowerCase()
                .includes(focused.value.toLowerCase()),
        );

        filtered = await filtered.map(async (member) => {
            let count = 0;
            let dbMember = await db.skippers.findOne({
                where: {
                    user: member.id,
                },
            });
            count = dbMember ? dbMember.count : 0;
            return {
                name: `${member.user.username} (${count}/${maxSkipCount})`,
                value: member.id,
                count: count,
            };
        });
        filtered = await Promise.all(filtered);

        filtered = await filtered.sort((a, b) => b.count - a.count);

        return await interaction.respond(
            filtered.slice(0, 25).map((user) => {
                return { name: user.name, value: user.value };
            }),
        );
    },
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const subcommand = interaction.options.getSubcommand();
        const { db } = require("../../index.js");
        if (subcommand === "add") {
            const username = interaction.options.getString("user");
            let dbUser;
            dbUser = await db.skippers.findOne({
                where: {
                    user: username,
                },
            });
            if (!dbUser) {
                dbUser = await db.skippers.create({
                    user: username,
                    count: 0,
                });
            }
            await dbUser.increment("count"); // value in database
            let skipper = dbUser.dataValues;
            skipper.count += 1; // local var

            const member = await interaction.guilds.cache
                .get(guildId)
                .members.cache.get(skipper.user);
            // ban the user if they at [maxSkipCount] now
            if (skipper.count === maxSkipCount) {
                if (member) {
                    await member.roles.add(feedbackBanID);
                    logger.info(`Feedback banned user ${member.user.username}`);
                    await db.skippers.destroy({
                        where: {
                            user: username,
                        },
                    });
                    return await interaction.editReply(
                        `${member.user.username} has been banned from feedback.`,
                    );
                } else {
                    logger.warn(
                        `User with ID ${skipper.user} not found in guild`,
                    );
                    return await interaction.editReply(
                        `Count increased to ${maxSkipCount}, but an error occurred while trying to add the feedback ban role.`,
                    );
                }
            }
            return await interaction.editReply(
                `Count for ${member.user.username} has been increased to ${skipper.count}.`,
            );
        } else if (subcommand === "remove") {
            const username = interaction.options.getString("user");
            let dbUser;
            dbUser = await db.skippers.findOne({
                where: {
                    user: username,
                },
            });
            if (!dbUser) {
                dbUser = await db.skippers.create({
                    user: username,
                    count: 0,
                });
            }
            let skipper = dbUser.dataValues;
            if (skipper.count === 0)
                return await interaction.editReply(
                    ":x: Count is already at 0!",
                );

            await dbUser.decrement("count"); // value in database
            skipper.count -= 1; // local var

            const member = await interaction.guilds.cache
                .get(guildId)
                .members.cache.get(skipper.user);
            return await interaction.editReply(
                `Count for ${member.user.username} has been decreased to ${skipper.count}.`,
            );
        }
    },
};
