import { task } from "@commandkit/tasks";
import type { Client } from "discord.js";
import { logger } from "./logger";

const running = new Set<string>();

/**
 * Defines a cron task (in src/app/tasks) that only runs once the client is
 * ready, never overlaps with a still-running previous run, and logs errors.
 *
 * The tasks plugin polls for due jobs and only reschedules a job once it has
 * finished, so a slow run would otherwise be started again.
 */
export function scheduledTask({
    name,
    schedule,
    execute
}: {
    name: string;
    /** Cron expression, in the server's timezone */
    schedule: string;
    execute(client: Client<true>): Promise<void>;
}) {
    return task({
        name,
        schedule,
        async prepare(ctx) {
            return ctx.client.isReady();
        },
        async execute(ctx) {
            if (running.has(name)) return;
            running.add(name);
            try {
                await execute(ctx.client as Client<true>);
            } catch (error) {
                logger.error(`Scheduled - Error running ${name}:`, error);
            } finally {
                running.delete(name);
            }
        }
    });
}
