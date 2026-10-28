import type { Client } from "discord.js";

export interface ScheduledTask {
    name: string;
    cron: string;
    enabled: boolean;
    execute(client: Client<true>): Promise<void>;
}
