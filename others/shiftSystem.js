const { guildId, staffRole, staffGuildId, shiftRoleID } = require("../config.json");

function getConfiguredStaffRoleId() {
    return staffRole || shiftRoleID || "1234";
}

async function getGuildWithRole(client) {
    const guildIdToUse = client.guilds.cache.has(staffGuildId)
        ? staffGuildId
        : guildId;
    return client.guilds.fetch(guildIdToUse);
}

async function getRoleMembers(guild) {
    const roleId = getConfiguredStaffRoleId();
    const role = guild.roles.cache.get(roleId)
        ? guild.roles.cache.get(roleId)
        : await guild.roles.fetch(roleId).catch(() => null);

    if (!role) return [];
    return [...role.members.values()].map((member) => member.user.id);
}

async function getActiveStaffIds(guild, db) {
    const staffIds = await getRoleMembers(guild);
    const active = [];

    for (const userId of staffIds) {
        const profile = await db.shiftMembers.findOne({
            where: { discordid: userId },
        });
        if (!profile || !profile.vacationMode) {
            active.push(userId);
        }
    }

    return active;
}

async function getGuildStaffCount(client, db) {
    const guild = await getGuildWithRole(client);
    return (await getActiveStaffIds(guild, db)).length;
}

async function ensureShiftMember(db, userId, userTag = null) {
    let profile = await db.shiftMembers.findOne({
        where: { discordid: userId },
    });

    if (!profile) {
        profile = await db.shiftMembers.create({
            discordid: userId,
            currentCount: 0,
            targetCount: 0,
            vacationMode: false,
            reminder5Sent: false,
            reminder6Sent: false,
            weekStartedAt: new Date(),
            tag: userTag,
        });
    }

    return profile;
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
        reminder6Sent: false,
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
        weekStartedAt: profile.weekStartedAt,
    };
}

async function incrementProgress(db, userId, amount = 1) {
    const profile = await ensureShiftMember(db, userId);
    const increment = Math.max(0, Number(amount || 1));
    await profile.update({
        currentCount: Number(profile.currentCount || 0) + increment,
        lastUpdated: new Date(),
    });
    return profile;
}

async function setVacationMode(db, userId, vacationMode) {
    const profile = await ensureShiftMember(db, userId);
    await profile.update({ vacationMode: Boolean(vacationMode) });
    return profile;
}

async function calculateTargetAssignments(db, guild) {
    const activeStaffIds = await getActiveStaffIds(guild, db);
    const state = await db.shiftState.findOne({ where: { id: 1 } });
    const pendingCount = Number((state && state.pendingCount) || 0);
    if (activeStaffIds.length === 0) {
        return { pendingCount, targetByUser: {} };
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

async function resetShiftWeek(db, guild, pendingCount) {
    const state = await db.shiftState.findOne({ where: { id: 1 } });
    const totalPending = Math.max(0, Number(pendingCount || state?.pendingCount || 0));
    const activeStaffIds = await getActiveStaffIds(guild, db);
    const { targetByUser } = await calculateTargetAssignments(db, guild);
    const weekStart = new Date();

    await db.shiftState.upsert({
        id: 1,
        pendingCount: totalPending,
        weekStartedAt: weekStart,
        reminder5Sent: false,
        reminder6Sent: false,
    });

    const allStaffIds = new Set(await getRoleMembers(guild));
    for (const memberId of allStaffIds) {
        const profile = await ensureShiftMember(db, memberId);
        const isVacation = Boolean(profile.vacationMode);
        const isActive = activeStaffIds.includes(memberId);
        await profile.update({
            targetCount: isActive && !isVacation ? targetByUser[memberId] || 0 : 0,
            currentCount: 0,
            weekStartedAt: weekStart,
            reminder5Sent: false,
            reminder6Sent: false,
            vacationMode: isVacation,
        });
    }

    return {
        pendingCount: totalPending,
        weekStart,
        targetByUser,
    };
}

async function processShiftReminders(client, db) {
    const state = await db.shiftState.findOne({ where: { id: 1 } });
    if (!state || !state.weekStartedAt) return [];

    const weekStart = new Date(state.weekStartedAt);
    const now = new Date();
    const notifications = [];
    const members = await db.shiftMembers.findAll({
        where: { vacationMode: false },
    });

    for (const member of members) {
        if (!member.discordid) continue;
        const currentCount = Number(member.currentCount || 0);
        const targetCount = Number(member.targetCount || 0);
        if (targetCount === 0 || currentCount >= targetCount) continue;

        const daysSinceStart = (now.getTime() - weekStart.getTime()) / 86400000;
        if (daysSinceStart >= 6 && !member.reminder6Sent) {
            try {
                const user = await client.users.fetch(member.discordid);
                await user.send(
                    `Reminder: you've only completed ${currentCount}/${targetCount} records for this week's shift. Please complete your remaining records as soon as possible.`
                );
                notifications.push(member.discordid);
                await member.update({ reminder6Sent: true });
            } catch {
                // Ignore missing/blocked DMs.
            }
            continue;
        }
        if (daysSinceStart >= 5 && !member.reminder5Sent) {
            try {
                const user = await client.users.fetch(member.discordid);
                await user.send(
                    `Reminder: your weekly shift is due soon. You have ${currentCount}/${targetCount} records completed so far.`
                );
                notifications.push(member.discordid);
                await member.update({ reminder5Sent: true });
            } catch {
                // Ignore missing/blocked DMs.
            }
        }
    }

    return notifications;
}

module.exports = {
    getConfiguredStaffRoleId,
    getGuildWithRole,
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
};
