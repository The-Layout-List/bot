import { SlashCommandBuilder, MessageFlags } from "discord.js";
import type {
    AutocompleteCommand,
    ChatInputCommand,
    CommandData,
    CommandMetadata
} from "commandkit";
import { config, commandGuilds } from "../../../lib/config";
import { logger } from "../../../lib/logger";
import isUrlHttp from "is-url-http";
import { db } from "../../../lib/db";
import { getTextChannel } from "../../../lib/discord";

const {
    guildId,
    reliableThreadID,
    staffRole,
    submissionsChannelID,
    clientId,
    debug,
    submissionRole
} = config;

export const command: CommandData = new SlashCommandBuilder()
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
                    .setDescription("The name of the level you want to check")
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
                    .setDescription("The name of the level you want to share")
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
    )
    .toJSON();

export const metadata: CommandMetadata = { guilds: commandGuilds() };

export const autocomplete: AutocompleteCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    const focused = interaction.options.getFocused(true);
    if (focused.name === "levelname") {
        // if user has staff role, show all levels in voting
        let levels;
        if (await interaction.member.roles.cache.has(staffRole))
            levels = await db.levelInVoting.findMany();
        else
            levels = await db.levelInVoting.findMany({
                where: {
                    shared: {
                        contains: interaction.user.id,
                        mode: "insensitive"
                    }
                }
            });
        return await interaction.respond(
            levels
                .filter((lvl) =>
                    (lvl.levelname ?? "")
                        .toLowerCase()
                        .includes(focused.value.toLowerCase())
                )
                .slice(0, 25)
                .map((lvl) => ({
                    name: lvl.levelname ?? "",
                    value: `${lvl.discordid}`
                }))
        );
    } else if (focused.name === "verifier") {
        const users = await db.cachedUser.findMany({
            where: {
                name: {
                    contains: focused.value.toLowerCase(),
                    mode: "insensitive"
                }
            }
        });
        return await interaction.respond(
            users
                .slice(0, 25)
                .map((user) => ({ name: user.name, value: user.name }))
        );
    }
};

export const chatInput: ChatInputCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "submit") {
        const levelname = interaction.options.getString("levelname", true);
        const verifier = interaction.options.getString("verifier", true);
        const verification = interaction.options.getString(
            "verification",
            true
        );
        const creators = interaction.options.getString("creators", true);
        const id = interaction.options.getInteger("id", true);
        const songname = interaction.options.getString("songname", true);
        const percent = interaction.options.getInteger("percent");
        const password = interaction.options.getString("password");
        const raw = interaction.options.getString("raw");
        const opinion = interaction.options.getString("opinion");
        const nong = interaction.options.getAttachment("nong");
        const enjoyment = interaction.options.getInteger("enjoyment");
        const note = interaction.options.getString("note");

        if (enjoyment !== null && (enjoyment > 10 || enjoyment < 0))
            return await interaction.editReply(
                ":x: that is NOT an enjoyment!!!! (0-10)."
            );

        const hasPerms =
            (await interaction.member.roles.cache.has(submissionRole)) ||
            (await interaction.member.roles.cache.some((role) =>
                role.name.toLowerCase().startsWith("level")
            ));

        // get the submitter from the db
        let user;
        try {
            user = await db.submitter.findFirst({
                where: {
                    discordid: interaction.user.id
                }
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

                const userResult = await db.submitter.create({
                    data: {
                        discordid: interaction.user.id,
                        submissions: 0,
                        dmFlag: false,
                        banned: false
                    }
                });
                user = userResult;
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
        if ((user.submissions ?? 0) >= 3 && !debug)
            return interaction.editReply(
                ":x: You've already submitted 3 levels this month! Please close the GD editor and touch some grass."
            );

        if (user.banned)
            return interaction.editReply(
                ":x: You've been submission banned! No more funny business."
            );

        const guild = await interaction.client.guilds.fetch(guildId);

        const voteChannel = guild.channels.cache.get(reliableThreadID);
        if (!voteChannel?.isThreadOnly())
            throw new Error(`Reliable channel ${reliableThreadID} not found`);

        let message =
            `_Submitted by: <@${interaction.user.id}>_\n\nLevel name: ${levelname}\nVerifier: ${verifier}\nVerification: ${verification}\nCreators: ${creators}\nID: \`${id}\`\nSong name: ${songname}` + // man don't askl me why itr needs to be formatted like this ik its ugly bro
            (percent ? `\nList percent: ${percent}%` : "") +
            (password ? `\nPassword: ${password}` : "") +
            (opinion ? `\nDifficulty opinion: ${opinion}` : "") +
            (enjoyment !== null
                ? `\nVerifier's enjoyment: ${enjoyment}/10`
                : "") +
            (nong ? `\nNONG: ${nong.url}` : "") +
            (note ? `\n\n_Additional notes: ${note}_` : "");

        const logChannel = getTextChannel(guild, submissionsChannelID);
        await logChannel.send(message);

        if (raw) message += `\nRaw: ${raw}`;

        const thread = await voteChannel.threads.create({
            name: `${levelname} 0-0`,
            autoArchiveDuration: 1440,
            reason: `New level submission by ${interaction.user.tag}`,
            message: { content: message }
        });

        logger.log(`Created thread: ${thread.name}`);

        // increment user's submission count
        await db.submitter.update({
            where: { id: user.id },
            data: { submissions: { increment: 1 } }
        });

        await db.levelInVoting.create({
            data: {
                levelname: levelname,
                submitter: interaction.user.id,
                discordid: thread.id,
                yeses: 0,
                nos: 0,
                shared: `${interaction.user.id};`,
                paused: false
            }
        });

        // i hate this so so so much
        const levelCount = await db.levelStats.findMany();
        await db.levelStats.update({
            where: { id: levelCount[0].id },
            data: { submissions: { increment: 1 } }
        });

        return interaction.editReply(
            ":white_check_mark: All done! Your level will be voted on by the Reliable team.\nYou can use /vote status to see their progress!"
        );
    } else if (subcommand === "dm") {
        const numStatus = await interaction.options.getInteger("status", true);

        const status = numStatus === 1 ? true : false;

        let submitter;
        submitter = await db.submitter.findFirst({
            where: { discordid: interaction.user.id }
        });

        if (!submitter)
            submitter = await db.submitter.create({
                data: {
                    discordid: interaction.user.id,
                    submissions: 0,
                    dmFlag: false,
                    banned: false
                }
            });

        try {
            await db.submitter.updateMany({
                where: { discordid: interaction.user.id },
                data: { dmFlag: status }
            });
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
        const level = await interaction.options.getString("levelname", true);

        const hasStaffRole =
            await interaction.member.roles.cache.has(staffRole);

        let submission;
        try {
            submission = await db.levelInVoting.findFirst({
                where: !hasStaffRole
                    ? {
                          discordid: level,
                          shared: {
                              contains: interaction.user.id,
                              mode: "insensitive"
                          }
                      }
                    : {
                          discordid: level
                      }
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
        const level = await interaction.options.getString("levelname", true);
        const user = await interaction.options.getUser("user", true);

        // if you try to share the vote with yourself, the layout list bot, or any other bot
        if (user.id === interaction.user.id || user.bot) {
            return interaction.editReply(":death: Nice try!");
        }

        if (user.id === clientId) {
            return interaction.editReply(
                ":death: Bro i did NOT build in this, ts is trash :sob:"
            );
        }

        const hasStaffRole =
            await interaction.member.roles.cache.has(staffRole);

        let submission;
        try {
            submission = await db.levelInVoting.findFirst({
                where: !hasStaffRole
                    ? {
                          discordid: level,
                          submitter: interaction.user.id
                      }
                    : {
                          discordid: level
                      }
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

        let dbSubmitter = await db.submitter.findFirst({
            where: {
                discordid: user.id
            }
        });

        if (!dbSubmitter) {
            dbSubmitter = await db.submitter.create({
                data: {
                    discordid: user.id,
                    submissions: 0,
                    dmFlag: false,
                    banned: false
                }
            });
        }

        const shared = (submission.shared ?? "").split(";");
        if (shared.includes(user.id))
            return interaction.editReply(
                ":x: That user already has access to this level!"
            );

        await db.levelInVoting.updateMany({
            where: {
                discordid: level
            },
            data: {
                shared: `${submission.shared ?? ""}${user.id};`
            }
        });

        return interaction.editReply(
            `Shared _${submission.levelname}_ with ${user.username}!`
        );
    }
};
