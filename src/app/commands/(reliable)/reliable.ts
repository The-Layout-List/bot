import {
    SlashCommandBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    AttachmentBuilder,
    MessageFlags
} from "discord.js";
import type {
    ChatInputCommand,
    CommandData,
    CommandMetadata
} from "commandkit";
import { logger } from "../../../lib/logger";
import { config, commandGuilds } from "../../../lib/config";
import { db } from "../../../lib/db";
import { getTextChannel } from "../../../lib/discord";

const { submissionResultsID, guildId } = config;

export const command: CommandData = new SlashCommandBuilder()
    .setName("reliable")
    .setDescription("Staff list management")
    .addSubcommand((subcommand) =>
        subcommand.setName("yes").setDescription("Add a yes vote to a level")
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
    )
    .toJSON();

export const metadata: CommandMetadata = { guilds: commandGuilds() };

export const chatInput: ChatInputCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = interaction.channel;

    if (interaction.options.getSubcommand() === "yes") {
        // if the current channel is not a thread
        if (!channel?.isThread()) {
            return await interaction.editReply(
                "Bro lock in this isnt a reliable thread"
            );
        }

        const dbEntry = await db.levelInVoting.findFirst({
            where: { discordid: channel.id }
        });

        if (!dbEntry)
            return await interaction.editReply(
                ":x: Couldn't find the level in the database!"
            );

        if (dbEntry.paused) {
            return await interaction.editReply(
                "This thread is paused, you can't vote on it!"
            );
        }

        await interaction.editReply("Checking thread name...");
        try {
            await interaction.editReply({
                content: "Changing thread name, this could take a while..."
            });

            // get last 10 messages in channel
            const messages = await channel.messages.fetch({
                limit: 10
            });

            // find the most recent message that contains "vote: "
            const voteMessage = messages.find((msg) =>
                msg.content.toLowerCase().includes("vote:")
            );

            // pin the message
            if (voteMessage) await voteMessage.pin();

            const message = await channel.send(
                `The vote is now at **${(dbEntry.yeses ?? 0) + 1}-${
                    dbEntry.nos
                }**. The thread name is being updated!!`
            );

            await channel.setName(
                `${dbEntry.levelname} ${(dbEntry.yeses ?? 0) + 1}-${dbEntry.nos}`,
                `Vote added by ${interaction.user.username}`
            ); // Set the channel name to the same thing but with the added yes

            await message.delete();

            // update entry in db
            await db.levelInVoting.updateMany({
                where: { discordid: channel.id },
                data: { yeses: (dbEntry.yeses ?? 0) + 1 }
            });

            const entry = { ...dbEntry, yeses: (dbEntry.yeses ?? 0) + 1 };

            const shared = (entry.shared ?? "").split(";");
            shared.pop();

            for (const user of shared) {
                const submitterDb = await db.submitter.findFirst({
                    where: {
                        discordid: { contains: user, mode: "insensitive" }
                    }
                });

                // check if the user has dmFlag set to true
                if (submitterDb?.dmFlag && entry.submitter) {
                    // get user by id of entry.submitter
                    const submitter = await interaction.guild.members.fetch(
                        entry.submitter
                    );
                    await submitter.send(
                        `The level _${dbEntry.levelname}_ has received a new yes vote!\nThe vote is now at **${entry.yeses}-${entry.nos}**.\n-# _To disable these messages, use the \`/vote dm\` command._`
                    );
                }
            }
        } catch (e) {
            logger.error(`Error: ${e}`);
            return await interaction.editReply(`Something went wrong: ${e}`);
        }

        return await interaction.editReply("Updated!");
    } else if (interaction.options.getSubcommand() === "no") {
        await interaction.editReply("Checking thread name...");
        // if the current channel is not a thread
        if (!channel?.isThread()) {
            return await interaction.editReply(
                "Bro lock in this isnt a reliable thread"
            );
        }

        const dbEntry = await db.levelInVoting.findFirst({
            where: { discordid: channel.id }
        });

        if (!dbEntry)
            return await interaction.editReply(
                ":x: Couldn't find the level in the database!"
            );

        if (dbEntry.paused) {
            return await interaction.editReply(
                "This thread is paused, you can't vote on it!"
            );
        }

        try {
            await interaction.editReply({
                content: "Changing thread name, this could take a while..."
            });

            // get last 10 messages in channel
            const messages = await channel.messages.fetch({
                limit: 10
            });

            // find the most recent message that contains "vote: "
            const voteMessage = messages.find((msg) =>
                msg.content.toLowerCase().includes("vote:")
            );

            // pin the message
            if (voteMessage) await voteMessage.pin();

            const message = await channel.send(
                `The vote is now at **${dbEntry.yeses}-${(dbEntry.nos ?? 0) + 1}**.`
            );

            await channel.setName(
                `${dbEntry.levelname} ${dbEntry.yeses}-${(dbEntry.nos ?? 0) + 1}`,
                `Vote added by ${interaction.user.username}`
            ); // Set the channel name to the same thing but with the added no

            await message.delete();

            // update entry in db
            await db.levelInVoting.updateMany({
                where: { discordid: channel.id },
                data: { nos: (dbEntry.nos ?? 0) + 1 }
            });

            const entry = { ...dbEntry, nos: (dbEntry.nos ?? 0) + 1 };

            const shared = (entry.shared ?? "").split(";");
            shared.pop();

            for (const user of shared) {
                const submitterDb = await db.submitter.findFirst({
                    where: {
                        discordid: { contains: user, mode: "insensitive" }
                    }
                });

                // check if the user has dmFlag set to true
                if (submitterDb?.dmFlag && entry.submitter) {
                    // get user by id of entry.submitter
                    const submitter = await interaction.guild.members.fetch(
                        entry.submitter
                    );
                    await submitter.send(
                        `The level _${dbEntry.levelname}_ has received a no vote...\nThe vote is now at **${entry.yeses}-${entry.nos}**.\n-# _To disable these messages, use the \`/vote dm\` command._`
                    );
                }
            }
        } catch (e) {
            logger.error(`Error: ${e}`);
            return await interaction.editReply(`Something went wrong: ${e}`);
        }

        // ping user if needed
        return await interaction.editReply("Updated!");
    } else if (
        interaction.options.getSubcommand() === "accept" ||
        interaction.options.getSubcommand() === "reject"
    ) {
        const guild = await interaction.client.guilds.fetch(guildId);

        const command = interaction.options.getSubcommand();
        const submissionsChannel = getTextChannel(guild, submissionResultsID);

        // if the current channel is not a thread
        if (!channel?.isThread()) {
            return await interaction.editReply(
                "Bro lock in this isnt a reliable thread"
            );
        }

        const submission = await db.levelInVoting.findFirst({
            where: { discordid: channel.id }
        });
        if (!submission)
            return await interaction.editReply(
                ":x: Couldn't find the level in the database!"
            );
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
                `Reason: ${interaction.options.getString("reason", true)}`
            );
        await interaction.editReply("Sending message...");
        const shared = (submission.shared ?? "").split(";");
        shared.pop();
        let pingMessage = "";
        for (const user of shared) pingMessage += `<@${user}> `;
        // add links to message
        const rawImgs = interaction.options.getString("images");
        const attachments: AttachmentBuilder[] = [];
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
            files: attachments
        });

        await submissionMessage.react("👍");
        await submissionMessage.react("👎");

        // i hate this so so so much
        const levelCount = await db.levelStats.findMany();

        await db.levelStats.update({
            where: { id: levelCount[0].id },
            data: {
                [command === "accept" ? "accepts" : "denies"]: { increment: 1 }
            }
        });

        await interaction.editReply({
            content: "Updating thread name..."
        });

        const message = await channel.send(
            `This level has been ${
                command === "accept" ? "accepted" : "rejected"
            }.`
        );

        await channel.setName(
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

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            deleteThread
        );

        await interaction.editReply({
            content: "The thread has been updated!",
            components: command === "reject" ? [row] : []
        });
        if (command === "reject") {
            await channel.setLocked(true);
            await channel.setArchived(true);
        }

        await db.levelInVoting.deleteMany({
            where: { discordid: channel.id }
        });

        return;
    } else if (interaction.options.getSubcommand() === "pause") {
        // if the current channel is not a thread
        if (!channel?.isThread()) {
            return await interaction.editReply(
                "Bro lock in this isnt a reliable thread"
            );
        }

        const dbEntry = await db.levelInVoting.findFirst({
            where: { discordid: channel.id }
        });

        if (!dbEntry)
            return await interaction.editReply(
                ":x: Couldn't find the level in the database!"
            );

        await interaction.editReply({
            content: "Changing thread name, this could take a while..."
        });

        const message = await channel.send(
            `This level has been ` + (dbEntry.paused ? "unpaused." : "paused.")
        );

        await channel.setName(
            `${dbEntry.levelname} ` +
                (dbEntry.paused
                    ? `${dbEntry.yeses}-${dbEntry.nos}`
                    : `(PAUSED)`),
            `Paused by ${interaction.user.username}`
        ); // Set the channel name to the same thing but with pause

        await message.delete();

        // update entry in db
        await db.levelInVoting.updateMany({
            where: { discordid: channel.id },
            data: { paused: !dbEntry.paused }
        });

        await interaction.editReply(
            "The thread has been " + (dbEntry.paused ? "unpaused!" : "paused!")
        );

        const entry = dbEntry;

        const shared = (entry.shared ?? "").split(";");
        shared.pop();

        for (const user of shared) {
            const submitterDb = await db.submitter.findFirst({
                where: {
                    discordid: { contains: user, mode: "insensitive" }
                }
            });

            if (!submitterDb?.dmFlag || !entry.submitter) continue;
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
        // if the current channel is not a thread
        if (!channel?.isThread()) {
            return await interaction.editReply(
                "Bro lock in this isnt a reliable thread"
            );
        }

        const dbEntry = await db.levelInVoting.findFirst({
            where: { discordid: channel.id }
        });

        if (!dbEntry)
            return await interaction.editReply(
                ":x: Couldn't find the level in the database!"
            );

        await interaction.editReply({
            content: "Changing thread name, this could take a while..."
        });

        const message = await channel.send(`The vote has been reset to 0-0.`);

        await channel.setName(
            `${dbEntry.levelname} 0-0`,
            `Reset by ${interaction.user.username}`
        ); // Set the channel name to the same thing but with the added pause

        await message.delete();

        // update entry in db
        await db.levelInVoting.updateMany({
            where: { discordid: channel.id },
            data: { yeses: 0, nos: 0 }
        });

        await interaction.editReply("The vote has been reset to 0-0!");

        const entry = dbEntry;

        const shared = (entry.shared ?? "").split(";");
        shared.pop();

        for (const user of shared) {
            const submitterDb = await db.submitter.findFirst({
                where: {
                    discordid: { contains: user, mode: "insensitive" }
                }
            });

            if (!submitterDb?.dmFlag || !entry.submitter) continue;
            // get user by id of entry.submitter
            const submitter = await interaction.guild.members.fetch(
                entry.submitter
            );
            await submitter.send(
                `The vote for the level _${dbEntry.levelname}_ has been reset to 0-0.\n-# _To disable these messages, use the \`/vote dm\` command._`
            );
        }
    }
};
