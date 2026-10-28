import type { Guild, GuildTextBasedChannel } from "discord.js";

/** Gets a text-based channel from the guild's cache, throwing if it's missing */
export function getTextChannel(
    guild: Guild,
    id: string
): GuildTextBasedChannel {
    const channel = guild.channels.cache.get(id);
    if (!channel?.isTextBased())
        throw new Error(`Text channel ${id} not found in ${guild.name}`);
    return channel;
}

/** Like getTextChannel, but for optional channels (e.g. configured as "0") */
export function findTextChannel(
    guild: Guild,
    id: string
): GuildTextBasedChannel | undefined {
    const channel = guild.channels.cache.get(id);
    return channel?.isTextBased() ? channel : undefined;
}
