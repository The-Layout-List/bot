import fs from "node:fs";
import path from "node:path";

export interface BotConfig {
    debug: boolean;

    enableSeparateStaffServer: boolean;
    enablePriorityRole: boolean;
    enableWelcomeMessage: boolean;
    enableChangelogMessage: boolean;

    scheduleCacheUpdate: string;
    scheduleChangelog: string;

    githubOwner: string;
    githubRepo: string;
    githubDataPath: string;
    githubBranch: string;

    clientId: string;
    guildId: string;
    staffGuildId: string;

    priorityRoleID: string;
    submissionLockRoleID: string;

    pendingRecordsID: string;
    priorityRecordsID: string;

    acceptedRecordsID: string;
    deniedRecordsID: string;
    archiveRecordsID: string;
    recordsID: string;

    changelogID: string;
    changelogRoleID: string;

    guildMemberAddID: string;

    submissionResultsID: string;
    reliableThreadID: string;
    staffRole: string;
    submissionsChannelID: string;
    submissionRole: string;

    feedbackChannels: string[];
    feedbackBanID: string;
    maxSkipCount: number;
    hqListStaffRoleId: string;
    shiftLogsChannelId: string;
    leaderShiftLogsChannelId: string;
    vacationModeRoleId: string;
}

// config.json is read at runtime (rather than bundled) so that switching
// between environments (see `npm run testenv`) doesn't require a rebuild.
const configPath = path.resolve(process.cwd(), "config.json");

export const config: BotConfig = JSON.parse(
    fs.readFileSync(configPath, "utf8")
);

/** Guilds that the bot's slash commands are registered in */
export const commandGuilds = (): string[] =>
    config.enableSeparateStaffServer
        ? [config.guildId, config.staffGuildId]
        : [config.guildId];

export default config;
