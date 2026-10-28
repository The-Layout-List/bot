import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import type {
    ChatInputCommand,
    CommandData,
    CommandMetadata
} from "commandkit";
import { config, commandGuilds } from "../../../lib/config";
import { logger } from "../../../lib/logger";
import updateLevels from "../../../scheduled/updateLevels";
import { db } from "../../../lib/db";

const { guildId, debug } = config;

export const command: CommandData = new SlashCommandBuilder()
    .setName("votemod")
    .setDescription("Moderator commands for levels in voting")
    .addSubcommand((subcommand) =>
        subcommand
            .setName("set")
            .setDescription("Update the information of a level in voting")
    )
    .addSubcommand((subcommand) =>
        subcommand.setName("debugclear").setDescription("Don't run this pls")
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
    )
    .toJSON();

export const metadata: CommandMetadata = { guilds: commandGuilds() };

export const chatInput: ChatInputCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (interaction.options.getSubcommand() === "setsubmissions") {
        const cmdUser = interaction.options.getString("user");
        const count = interaction.options.getInteger("submissions");

        // set submissions to 0
        try {
            await db.submitter.updateMany({
                where: cmdUser ? { discordid: cmdUser } : {},
                data: { submissions: count || 0 }
            });
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
        if (!debug) return await interaction.reply("Nope!");
        try {
            await db.levelInVoting.deleteMany({ where: {} });
            await db.submitter.deleteMany({ where: {} });
        } catch (error) {
            logger.error(error);
            return interaction.editReply(
                ":x: An error occurred while clearing the levels in voting. Please try again later."
            );
        }

        return interaction.editReply(":white_check_mark: Levels cleared!");
    } else if (interaction.options.getSubcommand() === "insert") {
        const channel = interaction.channel!;
        const text = channel.name;
        const matchLevelName = text.match(/^(.*)\s\d+-\d+$/);
        const user = interaction.options.getUser("submitter", true);
        const matchYes = text.match(/(\d+)-\d+$/);
        const matchNo = text.match(/\d+-(\d+)$/);
        if (!matchLevelName || !matchYes || !matchNo)
            return await interaction.editReply(
                ":x: Couldn't read the vote from the thread name"
            );

        let submitter;
        submitter = await db.submitter.findFirst({
            where: { discordid: user.id }
        });
        if (!submitter) {
            // create submitter
            submitter = await db.submitter.create({
                data: {
                    discordid: user.id,
                    submissions: 0,
                    dmFlag: false,
                    banned: false
                }
            });
        }

        await db.levelInVoting.create({
            data: {
                levelname: matchLevelName[1],
                submitter: user.id,
                discordid: channel.id,
                yeses: parseInt(matchYes[1]),
                nos: parseInt(matchNo[1]),
                shared: `${submitter.discordid};`,
                paused: false
            }
        });
        await interaction.editReply(":white_check_mark: Vote inserted!");
    } else if (interaction.options.getSubcommand() === "set") {
        const channel = interaction.channel!;
        const text = channel.name;
        const matchLevelName = text.match(/^(.*)\s\d+-\d+$/);
        const matchYes = text.match(/(\d+)-\d+$/);
        const matchNo = text.match(/\d+-(\d+)$/);
        if (!matchLevelName || !matchYes || !matchNo)
            return await interaction.editReply(
                ":x: Couldn't read the vote from the thread name"
            );

        const level = await db.levelInVoting.findFirst({
            where: { discordid: channel.id }
        });

        if (!level) return await interaction.editReply(":x: level not found");

        await db.levelInVoting.updateMany({
            where: {
                discordid: channel.id
            },
            data: {
                levelname: matchLevelName[1],
                yeses: parseInt(matchYes[1]),
                nos: parseInt(matchNo[1])
            }
        });
        await interaction.editReply(":white_check_mark: Vote updated!");
    } else if (interaction.options.getSubcommand() === "submitban") {
        const user = await interaction.options.getUser("submitter", true);
        const unban = await interaction.options.getInteger("unban");
        if (unban === 1) {
            await db.submitter.updateMany({
                where: {
                    discordid: user.id
                },
                data: {
                    banned: false
                }
            });
            return await interaction.editReply("The user has been unbanned");
        }
        await db.submitter.updateMany({
            where: {
                discordid: user.id
            },
            data: {
                banned: true
            }
        });

        const guild = await interaction.client.guilds.fetch(guildId);

        const levels = await db.levelInVoting.findMany({
            where: { submitter: user.id }
        });

        levels.forEach(async (level) => {
            const channel = guild.channels.cache.get(level.discordid ?? "");
            if (!channel?.isThread()) return;

            await channel.send(
                `:x: The submitter of this level has been submission banned, rejecting...`
            );

            await channel.setName(`${level.levelname} (REJECTED)`);

            await channel.setLocked(true);
            await channel.setArchived(true);
        });

        await db.levelInVoting.deleteMany({
            where: { submitter: user.id }
        });

        return await interaction.editReply(":x: This user has been banned!");
    } else if (interaction.options.getSubcommand() === "stats") {
        // i blame sequelize
        const dbInfo = await db.levelStats.findMany();
        const modInfo = dbInfo[0];

        const modInfoEmbed = new EmbedBuilder()
            .setColor(0xffbf00)
            .setTitle("Monthly submission info")
            .addFields(
                {
                    name: "Total submissions:",
                    value: `${modInfo.submissions}`,
                    inline: true
                },
                {
                    name: "Accepted levels:",
                    value: `${modInfo.accepts}`,
                    inline: true
                },
                {
                    name: "Denied levels:",
                    value: `${modInfo.denies}`,
                    inline: true
                }
            );

        return await interaction.editReply({
            embeds: [modInfoEmbed]
        });
    } else if (interaction.options.getSubcommand() === "sync") {
        await updateLevels.execute(interaction.client);
        return await interaction.editReply(":white_check_mark:");
    }
};
