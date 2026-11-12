import type { Client, Guild } from "discord.js";
import { config } from "./config";
import { db } from "./db";
import { shuffle } from "./utils";
import { Logger } from "commandkit";

const {
    guildId,
    staffGuildId,
    hqListStaffRoleId,
    leaderShiftLogsChannelId,
    vacationModeRoleId,
    shiftElo
} = config;

export async function getRoleMembers(guild: Guild): Promise<string[]> {
    const role = guild.roles.cache.get(hqListStaffRoleId);
    if (!role) return [];
    return [...role.members.values()].map((member) => member.user.id);
}
async function getVacationModeUsers(guild: Guild): Promise<string[]> {
    const role = guild.roles.cache.get(vacationModeRoleId);
    if (!role) return [];
    return [...role.members.values()].map((member) => member.user.id);
}

function getShiftGuild(client: Client): Guild {
    const guild = client.guilds.cache.get(staffGuildId ?? guildId);
    if (!guild) throw new Error("Shift guild not found in cache");
    return guild;
}

export async function getActiveStaffIds(guild: Guild): Promise<string[]> {
    const staffIds = await getRoleMembers(guild);
    const vacationModers = await getVacationModeUsers(guild);
    return staffIds.filter((id) => !vacationModers.includes(id));
}

export async function ensureShiftMember(userId: string) {
    const profile = await db.shiftMember.findUnique({
        where: { discordid: userId }
    });
    if (profile) return profile;

    return await db.shiftMember.create({
        data: {
            discordid: userId,
            currentCount: 0,
            targetCount: 0,
            reminder5Sent: false,
            reminder6Sent: false,
            elo: shiftElo.starting,
            totalElo: shiftElo.starting,
            weekStartedAt: new Date()
        }
    });
}

// ---------------------------------------------------------------------------
// Shift elo
// ---------------------------------------------------------------------------

/** Rounds to 2 decimals to avoid floating point drift (e.g. 0.1 + 0.2) */
function roundElo(value: number) {
    return Math.round(value * 100) / 100;
}

/** Clamps a regular elo value between the configured min and max */
export function clampElo(value: number) {
    return roundElo(Math.min(shiftElo.max, Math.max(shiftElo.min, value)));
}

/** Clamps a total elo value (only has a minimum, no maximum) */
export function clampTotalElo(value: number) {
    return roundElo(Math.max(shiftElo.min, value));
}

/** Formats an elo value for display, e.g. 15.5 or 23 */
export function formatElo(value: number) {
    return String(roundElo(value));
}

export async function getElo(userId: string) {
    const profile = await ensureShiftMember(userId);
    return { elo: profile.elo, totalElo: profile.totalElo };
}

export async function setElo(
    userId: string,
    elo: number,
    totalElo?: number | null
) {
    const profile = await ensureShiftMember(userId);
    return await db.shiftMember.update({
        where: { id: profile.id },
        data: {
            elo: clampElo(elo),
            ...(totalElo !== null && totalElo !== undefined
                ? { totalElo: clampTotalElo(totalElo) }
                : {})
        }
    });
}

export interface EloChange {
    userId: string;
    completed: boolean;
    currentCount: number;
    targetCount: number;
    /** Change actually applied to the regular elo (after clamping) */
    eloChange: number;
    newElo: number;
    /** Change actually applied to the total elo (after clamping) */
    totalEloChange: number;
    newTotalElo: number;
}

function getEloDmMessage(change: EloChange) {
    const gainedOrLost = change.eloChange >= 0 ? "gained" : "lost";
    const amount = formatElo(Math.abs(change.eloChange));
    if (change.completed) {
        return `You completed your shift this week! You ${gainedOrLost} **${amount} elo**. Your elo is now **${formatElo(change.newElo)}**.`;
    }
    return `You missed your shift this week (completed **${change.currentCount}/${change.targetCount}** records). You ${gainedOrLost} **${amount} elo**. Your elo is now **${formatElo(change.newElo)}**.`;
}

/**
 * Awards elo to every active staff member who had a shift this week
 * (gain for completing it, loss for missing it) and DMs them the result.
 * Must be called before the week's counts are reset.
 */
export async function applyShiftElo(client: Client): Promise<EloChange[]> {
    const guild = getShiftGuild(client);
    const members = await db.shiftMember.findMany({
        where: {
            discordid: { in: await getActiveStaffIds(guild) },
            targetCount: { gt: 0 }
        }
    });

    const changes: EloChange[] = [];
    for (const member of members) {
        const completed = member.currentCount >= member.targetCount;
        const delta = completed
            ? shiftElo.completedGain
            : -shiftElo.missedLoss;
        const newElo = clampElo(member.elo + delta);
        const newTotalElo = clampTotalElo(member.totalElo + delta);

        await db.shiftMember.update({
            where: { id: member.id },
            data: { elo: newElo, totalElo: newTotalElo }
        });

        const change: EloChange = {
            userId: member.discordid,
            completed,
            currentCount: member.currentCount,
            targetCount: member.targetCount,
            eloChange: roundElo(newElo - member.elo),
            newElo,
            totalEloChange: roundElo(newTotalElo - member.totalElo),
            newTotalElo
        };
        changes.push(change);

        try {
            const user = await client.users.fetch(member.discordid);
            await user.send(getEloDmMessage(change));
        } catch (e) {
            Logger.error(`Failed to send elo DM to user ${member.discordid}`);
            Logger.error(e);
        }
    }

    return changes;
}

function getReminderMessage(completedCount: number, pendingCount: number) {
    return `Reminder: your shift is due soon! You have completed ${completedCount}/${pendingCount} records.`;
}

export async function setPendingCount(count: number | null) {
    const pendingCount = Math.max(0, Number(count || 0));
    return await db.shiftState.upsert({
        where: { id: 1 },
        update: { pendingCount },
        create: {
            id: 1,
            pendingCount,
            weekStartedAt: new Date(),
            reminder5Sent: false,
            reminder6Sent: false
        }
    });
}

export async function setCurrentProgress(userId: string, value: number | null) {
    const profile = await ensureShiftMember(userId);
    const nextValue = Math.max(0, Number(value || 0));
    return await db.shiftMember.update({
        where: { id: profile.id },
        data: { currentCount: nextValue, lastUpdated: new Date() }
    });
}

export async function getCurrentProgress(userId: string) {
    const profile = await ensureShiftMember(userId);
    return {
        userId,
        currentCount: Number(profile.currentCount || 0),
        targetCount: Number(profile.targetCount || 0),
        reminder5Sent: Boolean(profile.reminder5Sent),
        reminder6Sent: Boolean(profile.reminder6Sent),
        weekStartedAt: profile.weekStartedAt
    };
}

export async function incrementProgress(userId: string, amount = 1) {
    const profile = await ensureShiftMember(userId);
    const increment = Math.max(0, Number(amount || 1));
    return await db.shiftMember.update({
        where: { id: profile.id },
        data: {
            currentCount: { increment },
            lastUpdated: new Date()
        }
    });
}

export async function calculateTargetAssignments(guild: Guild) {
    const state = await db.shiftState.findUnique({ where: { id: 1 } });
    const pendingCount = Number((state && state.pendingCount) || 0);
    const activeStaffIds = shuffle(await getActiveStaffIds(guild)).slice(
        0,
        pendingCount
    );
    const targetByUser: Record<string, number> = {};
    if (activeStaffIds.length === 0) {
        return { pendingCount, targetByUser };
    }
    const base = Math.floor(pendingCount / activeStaffIds.length);
    const remainder = pendingCount % activeStaffIds.length;
    for (let index = 0; index < activeStaffIds.length; index += 1) {
        const userId = activeStaffIds[index];
        targetByUser[userId] = base + (index < remainder ? 1 : 0);
    }
    return { pendingCount, targetByUser };
}

export async function resetShiftWeek(guild: Guild, pendingCount?: number) {
    const state = await db.shiftState.findUnique({ where: { id: 1 } });
    const totalPending = Math.max(
        0,
        Number(pendingCount || state?.pendingCount || 0)
    );
    const activeStaffIds = await getActiveStaffIds(guild);
    const { targetByUser } = await calculateTargetAssignments(guild);
    const weekStart = new Date();

    const stateData = {
        pendingCount: totalPending,
        weekStartedAt: weekStart,
        reminder5Sent: false,
        reminder6Sent: false
    };
    await db.shiftState.upsert({
        where: { id: 1 },
        update: stateData,
        create: { id: 1, ...stateData }
    });

    const allStaffIds = new Set(await getRoleMembers(guild));
    const vacationModeRoleMembers = await getVacationModeUsers(guild);
    for (const memberId of allStaffIds) {
        const profile = await ensureShiftMember(memberId);
        const isVacation = vacationModeRoleMembers.includes(memberId);
        const isActive = activeStaffIds.includes(memberId);
        await db.shiftMember.update({
            where: { id: profile.id },
            data: {
                targetCount:
                    isActive && !isVacation ? targetByUser[memberId] || 0 : 0,
                currentCount: 0,
                weekStartedAt: weekStart,
                reminder5Sent: false,
                reminder6Sent: false
            }
        });
    }

    return {
        pendingCount: totalPending,
        weekStart,
        targetByUser
    };
}

export async function processShiftReminders(client: Client): Promise<string[]> {
    const state = await db.shiftState.findUnique({ where: { id: 1 } });
    if (!state || !state.weekStartedAt) return [];

    const weekStart = new Date(state.weekStartedAt);
    const now = new Date();
    const notifications: string[] = [];
    const members = await db.shiftMember.findMany({
        where: {
            discordid: { in: await getActiveStaffIds(getShiftGuild(client)) },
            targetCount: { gt: 0 },
            currentCount: { lt: db.shiftMember.fields.targetCount }
        }
    });
    Logger.log(`Processing shift reminders for ${members.length} members.`)

    for (const member of members) {
        if (!member.discordid) continue;
        const currentCount = Number(member.currentCount || 0);
        const targetCount = Number(member.targetCount || 0);

        const daysSinceStart = (now.getTime() - weekStart.getTime()) / 86400000;
        if (daysSinceStart >= 5 && !member.reminder5Sent) {
            try {
                const user = await client.users.fetch(member.discordid);
                await user.send(getReminderMessage(currentCount, targetCount));
                notifications.push(member.discordid);
                await db.shiftMember.update({
                    where: { id: member.id },
                    data: { reminder5Sent: true }
                });
            } catch (e) {
                Logger.error(`Failed to send reminder 5 to user ${member.discordid}`)
                Logger.error(e)
            }
        } else if (daysSinceStart >= 6 && !member.reminder6Sent) {
            try {
                const user = await client.users.fetch(member.discordid);
                await user.send(getReminderMessage(currentCount, targetCount));
                notifications.push(member.discordid);
                await db.shiftMember.update({
                    where: { id: member.id },
                    data: { reminder6Sent: true }
                });
            } catch (e) {
                Logger.error(`Failed to send reminder 6 to user ${member.discordid}`)
                Logger.error(e)
            }
        }
    }

    return notifications;
}

export async function endShiftWeek(client: Client) {
    const guild = getShiftGuild(client);
    await applyShiftElo(client);
    const uncompletedShifts = await db.shiftMember.findMany({
        where: {
            discordid: { in: await getActiveStaffIds(guild) },
            currentCount: { lt: db.shiftMember.fields.targetCount }
        }
    });

    const shiftLogsChannel = guild.channels.cache.get(leaderShiftLogsChannelId);

    if (shiftLogsChannel?.isSendable()) {
        await shiftLogsChannel.send({
            allowedMentions: { parse: [] },
            content: `The weekly shift has ended. Uncompleted shifts:${uncompletedShifts.length > 0 ? "\n\n" : " None!"}${uncompletedShifts.map((shift) => `<@${shift.discordid}> - ${shift.currentCount}/${shift.targetCount}`).join("\n")}`
        });
    }
    return uncompletedShifts;
}
