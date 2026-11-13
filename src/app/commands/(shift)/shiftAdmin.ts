import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    EmbedBuilder
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
    endShiftWeek,
    getRoleMembers,
    getElo,
    setElo,
    formatElo,
    formatStreak,
    setStreak,
    getShiftHistory
} from "../../../lib/shiftSystem";
import { config, commandGuilds } from "../../../lib/config";
import { db } from "../../../lib/db";

const { staffGuildId, guildId, shiftLogsChannelId, shiftElo } = config;

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
    .addSubcommand((subcommand) =>
        subcommand
            .setName("elo")
            .setDescription(
                "View a staff member's shift elo, total elo and streak"
            )
            .addUserOption((option) =>
                option
                    .setName("member")
                    .setDescription("Staff member to view")
                    .setRequired(true)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("history")
            .setDescription("View the shift history of a staff member")
            .addUserOption((option) =>
                option
                    .setName("member")
                    .setDescription("Staff member to view")
                    .setRequired(true)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("set-elo")
            .setDescription("Set a staff member's shift elo")
            .addUserOption((option) =>
                option
                    .setName("member")
                    .setDescription("Staff member to update")
                    .setRequired(true)
            )
            .addNumberOption((option) =>
                option
                    .setName("elo")
                    .setDescription(
                        `New elo (${shiftElo.min} to ${shiftElo.max})`
                    )
                    .setMinValue(shiftElo.min)
                    .setMaxValue(shiftElo.max)
                    .setRequired(true)
            )
            .addNumberOption((option) =>
                option
                    .setName("total")
                    .setDescription(
                        "New total elo (leave empty to keep the current total)"
                    )
                    .setMinValue(shiftElo.min)
                    .setRequired(false)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("set-streak")
            .setDescription("Set a staff member's shift streak")
            .addUserOption((option) =>
                option
                    .setName("member")
                    .setDescription("Staff member to update")
                    .setRequired(true)
            )
            .addIntegerOption((option) =>
                option
                    .setName("streak")
                    .setDescription("New streak (shifts completed in a row)")
                    .setMinValue(0)
                    .setRequired(true)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("elo-lb")
            .setDescription("View the shift elo of all staff members")
    )
    .toJSON();

// Keep the reply under Discord's 2000 character message limit
const MAX_HISTORY_SHOWN = 250;

export const metadata: CommandMetadata = { guilds: commandGuilds() };

export const chatInput: ChatInputCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    const subcommand = interaction.options.getSubcommand();
    await interaction.deferReply({
        flags: [
            "view-member",
            "view-progress",
            "elo",
            "elo-lb",
            "set-elo",
            "set-streak",
            "history"
        ].includes(subcommand)
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
                    notIn: await getRoleMembers(shiftGuild)
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
            where: { targetCount: { gt: 0 }, discordid: { in: activeIds } }
        });
        const isCompleted = (shift: (typeof shifts)[number]) =>
            shift.currentCount >= shift.targetCount;
        return interaction.editReply({
            content: shifts
                .sort((a, b) => Number(isCompleted(a)) - Number(isCompleted(b)))
                .map(
                    (shift) =>
                        `<@${shift.discordid}> - **${shift.currentCount} / ${shift.targetCount}**${
                            isCompleted(shift) ? " *(Completed)*" : ""
                        }${
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
    } else if (subcommand === "elo") {
        const member = interaction.options.getUser("member", true);
        const { elo, totalElo, streak } = await getElo(member.id);
        return interaction.editReply({
            content: `Shift elo for <@${member.id}>:\nElo: **${formatElo(elo)}**\nTotal elo: **${formatElo(totalElo)}**\nStreak: **${formatStreak(streak)}**`
        });
    } else if (subcommand === "set-elo") {
        const member = interaction.options.getUser("member", true);
        const elo = interaction.options.getNumber("elo", true);
        const total = interaction.options.getNumber("total");
        const updated = await setElo(member.id, elo, total);
        return interaction.editReply({
            allowedMentions: { parse: [] },
            content: `Shift elo for <@${member.id}> has been set to **${formatElo(updated.elo)}** (total elo: **${formatElo(updated.totalElo)}**).`
        });
    } else if (subcommand === "set-streak") {
        const member = interaction.options.getUser("member", true);
        const streak = interaction.options.getInteger("streak", true);
        const updated = await setStreak(member.id, streak);
        return interaction.editReply({
            allowedMentions: { parse: [] },
            content: `Shift streak for <@${member.id}> has been set to **${formatStreak(updated.streak)}**.`
        });
    } else if (subcommand === "elo-lb") {
        const guild = interaction.client.guilds.cache.get(
            staffGuildId ?? guildId
        );
        if (!guild) return await interaction.editReply(":x: Guild not found");
        const staffIds = await getRoleMembers(guild);
        const profiles = await db.shiftMember.findMany({
            where: { discordid: { in: staffIds } }
        });
        const eloByUser = new Map(
            profiles.map((profile) => [profile.discordid, profile])
        );
        // Staff members without a shift profile yet are shown with the
        // starting elo (a profile is created the first time it's needed)
        const entries = staffIds
            .map((userId) => ({
                userId,
                elo: eloByUser.get(userId)?.elo ?? shiftElo.starting,
                totalElo: eloByUser.get(userId)?.totalElo ?? shiftElo.starting,
                streak: eloByUser.get(userId)?.streak ?? 0
            }))
            .sort((a, b) => b.elo - a.elo || b.totalElo - a.totalElo);

        if (entries.length === 0) {
            return interaction.editReply({
                content: "No staff members found."
            });
        }

        const lines = entries.map(
            (entry, index) =>
                `**${index + 1}.** <@${entry.userId}> - **${formatElo(entry.elo)}** elo (total: ${formatElo(entry.totalElo)}) ${formatStreak(entry.streak)}`
        );
        // Embed descriptions are limited to 4096 characters
        let description = "";
        for (const line of lines) {
            if (description.length + line.length + 1 > 4000) {
                description += "\n...";
                break;
            }
            description += (description ? "\n" : "") + line;
        }

        return interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("Shift elo leaderboard")
                    .setDescription(description)
            ]
        });
    } else if (subcommand === "history") {
        const member = interaction.options.getUser("member", true);
        const history = await getShiftHistory(member.id);
        if (history.length === 0) {
            return interaction.editReply({
                content: `No shift history found for <@${member.id}>.`,
                allowedMentions: { parse: [] }
            });
        }
        const shown = history.slice(-MAX_HISTORY_SHOWN);
        const results = shown
            .map((shift) =>
                shift.completedCount >= shift.targetCount ? "✅" : "❌"
            )
            .join(" => ");
        return interaction.editReply({
            content: `__Shift history for <@${member.id}>:__\n\n${
                history.length > shown.length ? "... => " : ""
            }${results}\n*(${history.length} total)*`,
            allowedMentions: { parse: [] }
        });
    }
};
