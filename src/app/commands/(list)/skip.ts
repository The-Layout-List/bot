import { SlashCommandBuilder, MessageFlags } from "discord.js";
import type {
    AutocompleteCommand,
    ChatInputCommand,
    CommandData,
    CommandMetadata
} from "commandkit";
import { config, commandGuilds } from "../../../lib/config";
import { logger } from "../../../lib/logger";
import { db } from "../../../lib/db";

const { feedbackBanID, maxSkipCount, guildId } = config;

export const command: CommandData = new SlashCommandBuilder()
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
    )
    .toJSON();

export const metadata: CommandMetadata = { guilds: commandGuilds() };

export const autocomplete: AutocompleteCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    // TODO: use less db queries
    const focused = interaction.options.getFocused(true);
    const members = interaction.client.guilds.cache.get(guildId)?.members.cache;
    if (!members) return await interaction.respond([]);
    const matching = members.filter((member) =>
        member.user.username.toLowerCase().includes(focused.value.toLowerCase())
    );

    const filtered = await Promise.all(
        matching.map(async (member) => {
            const dbMember = await db.skipper.findUnique({
                where: {
                    user: member.id
                }
            });
            const count = dbMember?.count ?? 0;
            return {
                name: `${member.user.username} (${count}/${maxSkipCount})`,
                value: member.id,
                count: count
            };
        })
    );

    filtered.sort((a, b) => b.count - a.count);

    return await interaction.respond(
        filtered.slice(0, 25).map((user) => {
            return { name: user.name, value: user.value };
        })
    );
};

export const chatInput: ChatInputCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "add") {
        const username = interaction.options.getString("user", true);
        const skipper = await db.skipper.upsert({
            where: { user: username },
            update: { count: { increment: 1 } },
            create: { user: username, count: 1 }
        });
        const count = skipper.count ?? 0;

        const member = interaction.client.guilds.cache
            .get(guildId)
            ?.members.cache.get(username);
        // ban the user if they at [maxSkipCount] now
        if (count === maxSkipCount) {
            if (member) {
                await member.roles.add(feedbackBanID);
                logger.info(`Feedback banned user ${member.user.username}`);
                await db.skipper.deleteMany({
                    where: {
                        user: username
                    }
                });
                return await interaction.editReply(
                    `${member.user.username} has been banned from feedback.`
                );
            } else {
                logger.warn(`User with ID ${skipper.user} not found in guild`);
                return await interaction.editReply(
                    `Count increased to ${maxSkipCount}, but an error occurred while trying to add the feedback ban role.`
                );
            }
        }
        return await interaction.editReply(
            `Count for ${member?.user.username} has been increased to ${count}.`
        );
    } else if (subcommand === "remove") {
        const username = interaction.options.getString("user", true);
        const existing = await db.skipper.upsert({
            where: { user: username },
            update: {},
            create: { user: username, count: 0 }
        });
        if (!existing.count)
            return await interaction.editReply(":x: Count is already at 0!");

        const skipper = await db.skipper.update({
            where: { id: existing.id },
            data: { count: { decrement: 1 } }
        });

        const member = interaction.client.guilds.cache
            .get(guildId)
            ?.members.cache.get(username);
        return await interaction.editReply(
            `Count for ${member?.user.username} has been decreased to ${skipper.count}.`
        );
    }
};
