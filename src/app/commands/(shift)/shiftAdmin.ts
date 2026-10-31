import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags
} from "discord.js";
import type {
    ChatInputCommand,
    CommandData,
    CommandMetadata
} from "commandkit";
import {
    setPendingCount,
    resetShiftWeek,
    setCurrentProgress,
    processShiftReminders,
    getActiveStaffIds,
    endShiftWeek
} from "../../../lib/shiftSystem";
import { config, commandGuilds } from "../../../lib/config";
import { db } from "../../../lib/db";

const { staffGuildId, guildId, shiftLogsChannelId } = config;

export const command: CommandData = new SlashCommandBuilder()
    .setName("shift-admin")
    .setDescription("Administrative commands for managing the weekly shift")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
        subcommand
            .setName("setpending")
            .setDescription(
                "Tell the bot how many records are pending at the start of the week"
            )
            .addIntegerOption((option) =>
                option
                    .setName("count")
                    .setDescription("Pending record count")
                    .setRequired(true)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("resetweek")
            .setDescription("Reset the weekly shift and assign even workloads")
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("setcount")
            .setDescription(
                "Manually set the current reviewed count for a staff member"
            )
            .addUserOption((option) =>
                option
                    .setName("member")
                    .setDescription("Staff member to update")
                    .setRequired(true)
            )
            .addIntegerOption((option) =>
                option
                    .setName("count")
                    .setDescription("Current reviewed count for the week")
                    .setRequired(true)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("force-remind")
            .setDescription("Send shift reminders to all staff members")
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("filter-members")
            .setDescription(
                "Refreshes the list of staff members eligible for shifts"
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("view-progress")
            .setDescription(
                "View the current reviewed count for all staff members"
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("view-member")
            .setDescription(
                "View the current shift progress for a staff member"
            )
            .addUserOption((option) =>
                option
                    .setName("member")
                    .setDescription("Staff member to view")
                    .setRequired(true)
            )
    )
    .toJSON();

export const metadata: CommandMetadata = { guilds: commandGuilds() };

export const chatInput: ChatInputCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    const subcommand = interaction.options.getSubcommand();
    await interaction.deferReply({
        flags: ["view-member", "view-progress"].includes(subcommand)
            ? MessageFlags.Ephemeral
            : undefined
    });
    if (subcommand === "setpending") {
        const count = interaction.options.getInteger("count", true);
        await setPendingCount(count);
        return interaction.editReply({
            content: `Weekly pending count set to ${count}.`
        });
    } else if (subcommand === "resetweek") {
        await endShiftWeek(interaction.client);

        const state = await db.shiftState.findUnique({ where: { id: 1 } });
        const pending = state?.pendingCount ?? 0;
        const { pendingCount, targetByUser } = await resetShiftWeek(
            interaction.guild,
            pending
        );

        const shiftlogsChannel = interaction.client.guilds.cache
            .get(staffGuildId ?? guildId)
            ?.channels.cache.get(shiftLogsChannelId);
        if (shiftlogsChannel?.isSendable()) {
            await shiftlogsChannel.send({
                content: `New shifts just dropped!!\n\n${Object.entries(
                    targetByUser
                )
                    .map(
                        ([userId, count]) =>
                            `<@${userId}> - **${count} records**`
                    )
                    .join("\n")}`,
                allowedMentions: {
                    users: Object.entries(targetByUser)
                        .filter(([, count]) => count > 0)
                        .map(([userId]) => userId)
                }
            });
        }

        return interaction.editReply({
            content: `Weekly shift reset complete. ${pendingCount} pending records were spread across staff members.`
        });
    } else if (subcommand === "setcount") {
        const member = interaction.options.getUser("member", true);
        const count = interaction.options.getInteger("count", true);
        await setCurrentProgress(member.id, count);
        return interaction.editReply({
            content: `Current reviewed total for <@${member.id}> has been set to ${count}.`
        });
    } else if (subcommand === "force-remind") {
        const notifications = await processShiftReminders(interaction.client);
        return interaction.editReply({
            content: `Shift reminders sent to ${notifications.length} staff members.`
        });
    } else if (subcommand === "filter-members") {
        const shiftGuild = interaction.client.guilds.cache.get(
            staffGuildId ?? guildId
        );
        if (!shiftGuild) throw new Error("Shift guild not found in cache");
        const { count: deletedCount } = await db.shiftMember.deleteMany({
            where: {
                discordid: {
                    notIn: await getActiveStaffIds(shiftGuild)
                }
            }
        });

        return interaction.editReply({
            content: `Staff members eligible for shifts have been refreshed. Removed ${deletedCount} members.`
        });
    } else if (subcommand === "view-progress") {
        const guild = interaction.client.guilds.cache.get(
            staffGuildId ?? guildId
        );
        if (!guild) return await interaction.editReply(":x: Guild not found");
        const activeIds = await getActiveStaffIds(guild);
        const shifts = await db.shiftMember.findMany({
            where: { targetCount: { gt: 0 }, discordId: { in: activeIds } }
        });
        return interaction.editReply({
            content: shifts
                .map(
                    (shift) =>
                        `<@${shift.discordid}> - **${shift.currentCount} / ${shift.targetCount}**${
                            interaction.client.guilds.cache
                                .get(staffGuildId ?? guildId)
                                ?.members.cache.get(shift.discordid)
                                ?.roles.cache.has(config.vacationModeRoleId)
                                ? " (Vacation mode)"
                                : ""
                        }`
                )
                .join("\n")
        });
    } else if (subcommand === "view-member") {
        const member = interaction.options.getUser("member", true);
        const shift = await db.shiftMember.findUnique({
            where: {
                discordid: member.id
            }
        });
        return interaction.editReply({
            content: shift
                ? `<@${shift.discordid}> - **${shift.currentCount} / ${shift.targetCount}**`
                : `No shift data found for <@${member.id}>.`
        });
    }
};
