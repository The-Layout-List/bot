import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { sqlLogger } from "./logger";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const db = new PrismaClient({
    adapter,
    log: [{ emit: "event", level: "query" }]
});

db.$on("query", (e) =>
    sqlLogger.debug(`${e.query} ${e.params} (${e.duration}ms)`)
);

/** The current date, as stored in date-only columns */
export function today(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

type DailyStatCounter =
    | "nbRecordsSubmitted"
    | "nbRecordsAccepted"
    | "nbRecordsDenied"
    | "nbMembersJoined"
    | "nbMembersLeft";

/**
 * Increments one of today's daily stats counters, creating today's row
 * (with a snapshot of the pending records count) if it doesn't exist yet.
 */
export async function incrementDailyStat(
    counter: DailyStatCounter,
    amount = 1
): Promise<void> {
    const date = today();
    await db.dailyStats.upsert({
        where: { date },
        update: { [counter]: { increment: amount } },
        create: {
            date,
            [counter]: amount,
            nbRecordsPending: await db.pendingRecord.count()
        }
    });
}

export default db;
