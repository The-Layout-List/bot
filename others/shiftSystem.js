const { Guild } = require("discord.js");
const {
    guildId,
    staffGuildId,
    hqListStaffRoleId,
    leaderShiftLogsChannelId
} = require("../config.json");
const { Sequelize } = require("sequelize");
const { shuffle } = require('../startUtils')
const logger = require("log4js").getLogger();

/**
 *
 * @param {Guild} guild
 * @returns
 */
async function getRoleMembers(guild) {
    const role = guild.roles.cache.get(hqListStaffRoleId);
    if (!role) return [];
    logger.log([...role.members.keys()])
    return [...role.members.values()].map((member) => member.user.id);
}

/**
 *
 * @param {Guild} guild
 * @param db
 * @returns
 */
async function getActiveStaffIds(guild, db) {
    const staffIds = await getRoleMembers(guild);
    logger.log(staffIds)

    const dbActiveStaff = await db.shiftMembers.findAll({
        where: { vacationMode: false },
        attributes: ["discordid"]
    });

    return staffIds.filter((id) =>
        dbActiveStaff.some((staff) => staff.discordid === id)
    );
}

async function getGuildStaffCount(client, db) {
    const guild = client.guilds.cache.get(staffGuildId ?? guildId);
    return (await getActiveStaffIds(guild, db)).length;
}

async function ensureShiftMember(db, userId) {
    const profile = await db.shiftMembers.findOne({
        where: { discordid: userId }
    });
    if (profile) return profile;

    return await db.shiftMembers.create({
        discordid: userId,
        currentCount: 0,
        targetCount: 0,
        vacationMode: false,
        reminder5Sent: false,
        reminder6Sent: false,
        weekStartedAt: new Date()
    });
}

function getReminderMessage(completedCount, pendingCount) {
    return `Reminder: your shift is due soon! You have completed ${completedCount}/${pendingCount} records.`;
}
async function setPendingCount(db, count) {
    const pendingCount = Math.max(0, Number(count || 0));
    const state = await db.shiftState.findOne({ where: { id: 1 } });
    if (state) {
        await state.update({ pendingCount, updatedAt: new Date() });
        return state;
    }
    return db.shiftState.create({
        id: 1,
        pendingCount,
        weekStartedAt: new Date(),
        reminder5Sent: false,
        reminder6Sent: false
    });
}

async function setCurrentProgress(db, userId, value) {
    const profile = await ensureShiftMember(db, userId);
    const nextValue = Math.max(0, Number(value || 0));
    await profile.update({ currentCount: nextValue, lastUpdated: new Date() });
    return profile;
}

async function getCurrentProgress(db, userId) {
    const profile = await ensureShiftMember(db, userId);
    return {
        userId,
        currentCount: Number(profile.currentCount || 0),
        targetCount: Number(profile.targetCount || 0),
        vacationMode: Boolean(profile.vacationMode),
        reminder5Sent: Boolean(profile.reminder5Sent),
        reminder6Sent: Boolean(profile.reminder6Sent),
        weekStartedAt: profile.weekStartedAt
    };
}

async function incrementProgress(db, userId, amount = 1) {
    const profile = await ensureShiftMember(db, userId);
    const increment = Math.max(0, Number(amount || 1));
    await profile.update({
        currentCount: Number(profile.currentCount || 0) + increment,
        lastUpdated: new Date()
    });
    return profile;
}

async function setVacationMode(db, userId, vacationMode) {
    const profile = await ensureShiftMember(db, userId);
    await profile.update({ vacationMode: Boolean(vacationMode) });
    return profile;
}

async function calculateTargetAssignments(db, guild) {
    let activeStaffIds = await getActiveStaffIds(guild, db);
    const state = await db.shiftState.findOne({ where: { id: 1 } });
    const pendingCount = Number((state && state.pendingCount) || 0);
    if (activeStaffIds.length === 0) {
        return { pendingCount, targetByUser: {} };
    }
    if (activeStaffIds.length > pendingCount) {
        activeStaffIds = shuffle(activeStaffIds).slice(0, pendingCount)
    }
    const base = Math.floor(pendingCount / activeStaffIds.length);
    const remainder = pendingCount % activeStaffIds.length;
    const targetByUser = {};
    for (let index = 0; index < activeStaffIds.length; index += 1) {
        const userId = activeStaffIds[index];
        targetByUser[userId] = base + (index < remainder ? 1 : 0);
    }
    return { pendingCount, targetByUser };
}

/**
 *
 * @param {*} db
 * @param {import('discord.js').Guild} guild
 * @param {number} pendingCount
 * @returns
 */
async function resetShiftWeek(db, guild, pendingCount) {
    const state = await db.shiftState.findOne({ where: { id: 1 } });
    const totalPending = Math.max(
        0,
        Number(pendingCount || state?.pendingCount || 0)
    );
    const activeStaffIds = await getActiveStaffIds(guild, db);
    const { targetByUser } = await calculateTargetAssignments(db, guild);
    const weekStart = new Date();

    await db.shiftState.upsert({
        id: 1,
        pendingCount: totalPending,
        weekStartedAt: weekStart,
        reminder5Sent: false,
        reminder6Sent: false
    });

    const allStaffIds = new Set(await getRoleMembers(guild));
    logger.log(allStaffIds)
    for (const memberId of allStaffIds) {
        let profile = await ensureShiftMember(db, memberId);
        const isVacation = Boolean(profile.vacationMode);
        const isActive = activeStaffIds.includes(memberId);
        profile = await profile.update({
            targetCount:
                isActive && !isVacation ? targetByUser[memberId] || 0 : 0,
            currentCount: 0,
            weekStartedAt: weekStart,
            reminder5Sent: false,
            reminder6Sent: false,
            vacationMode: isVacation
        });
    }

    return {
        pendingCount: totalPending,
        weekStart,
        targetByUser
    };
}

async function processShiftReminders(client, db) {
    const state = await db.shiftState.findOne({ where: { id: 1 } });
    if (!state || !state.weekStartedAt) return [];

    const weekStart = new Date(state.weekStartedAt);
    const now = new Date();
    const notifications = [];
    let members = await db.shiftMembers.findAll({
        where: {
            discordid: await getActiveStaffIds(
                client.guilds.cache.get(staffGuildId ?? guildId),
                db
            ),
            vacationMode: false,
            targetCount: { [Sequelize.Op.gt]: 0 },
            currentCount: {
                [Sequelize.Op.lt]: Sequelize.col("targetCount")
            }
        }
    });

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
                await member.update({ reminder5Sent: true });
            } catch {
                // Ignore missing/blocked DMs.
            }
        } else if (daysSinceStart >= 6 && !member.reminder6Sent) {
            try {
                const user = await client.users.fetch(member.discordid);
                await user.send(getReminderMessage(currentCount, targetCount));
                notifications.push(member.discordid);
                await member.update({ reminder6Sent: true });
            } catch {
                // Ignore missing/blocked DMs.
            }
        }
    }

    return notifications;
}

async function endShiftWeek(client, db) {
    const uncompletedShifts = await db.shiftMembers.findAll({
        where: {
            discordid: await getActiveStaffIds(
                client.guilds.cache.get(staffGuildId ?? guildId),
                db
            ),
            vacationMode: false,
            currentCount: {
                [Sequelize.Op.lt]: Sequelize.col("targetCount")
            }
        }
    });

    const shiftLogsChannel = await client.guilds.cache
        .get(staffGuildId ?? guildId)
        .channels.cache.get(leaderShiftLogsChannelId);

    await shiftLogsChannel.send({
        allowedMentions: { parse: [] },
        content: `The weekly shift has ended. Uncompleted shifts:${uncompletedShifts.length > 0 ? "\n\n" : " None!"}${uncompletedShifts.map((shift) => `<@${shift.discordid}> - ${shift.currentCount}/${shift.targetCount}`).join("\n")}`
    });
    return uncompletedShifts;
}

module.exports = {
    getActiveStaffIds,
    getGuildStaffCount,
    ensureShiftMember,
    setPendingCount,
    setCurrentProgress,
    getCurrentProgress,
    incrementProgress,
    setVacationMode,
    calculateTargetAssignments,
    resetShiftWeek,
    processShiftReminders,
    endShiftWeek
};
