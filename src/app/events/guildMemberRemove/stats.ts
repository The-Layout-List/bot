import type { GuildMember, PartialGuildMember } from "discord.js";
import { config } from "../../../lib/config";
import { incrementDailyStat } from "../../../lib/db";

export default async function (member: GuildMember | PartialGuildMember) {
    if (member.guild.id != config.guildId) return;

    await incrementDailyStat("nbMembersLeft");
}
