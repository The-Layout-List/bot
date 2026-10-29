import type { AnyThreadChannel } from "discord.js";

export default async function (thread: AnyThreadChannel) {
    await thread.join();
}
