import { Prisma } from "../generated/prisma/client";
import { db } from "./db";

export interface DailyCount {
    /** YYYY-MM-DD */
    date: string;
    count: number;
}

/** Counts accepted/denied records per day (by creation date) */
export async function countRecordsPerDay(
    table: "acceptedRecords" | "deniedRecords",
    { moderator, since }: { moderator?: string; since?: Date } = {}
): Promise<DailyCount[]> {
    const conditions = [Prisma.sql`TRUE`];
    if (moderator !== undefined)
        conditions.push(Prisma.sql`"moderator" = ${moderator}`);
    if (since !== undefined)
        conditions.push(Prisma.sql`"createdAt" >= ${since}`);

    const rows = await db.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT to_char(DATE("createdAt"), 'YYYY-MM-DD') AS "date", COUNT(*) AS "count"
        FROM ${Prisma.raw(`"${table}"`)}
        WHERE ${Prisma.join(conditions, " AND ")}
        GROUP BY 1
        ORDER BY 1`;

    return rows.map((row) => ({ date: row.date, count: Number(row.count) }));
}

/** Submitters with the most records in the given table */
export async function topSubmitters(
    table: "pendingRecords" | "acceptedRecords" | "deniedRecords",
    limit: number
): Promise<{ submitter: string | null; count: number }[]> {
    const rows = await db.$queryRaw<
        { submitter: string | null; count: bigint }[]
    >`
        SELECT "submitter", COUNT(*) AS "count"
        FROM ${Prisma.raw(`"${table}"`)}
        GROUP BY "submitter"
        ORDER BY "count" DESC
        LIMIT ${limit}`;

    return rows.map((row) => ({
        submitter: row.submitter,
        count: Number(row.count)
    }));
}
