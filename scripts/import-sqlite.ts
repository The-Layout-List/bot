// One-off migration of the old Sequelize SQLite database into Postgres.
//
// Usage (after `npm run db:deploy` has created the tables):
//   npm run db:import-sqlite -- [path/to/database.sqlite]
//
// The list cache (cache.sqlite) isn't imported: it is rebuilt from the list
// repository when the bot starts.

import "dotenv/config";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";

// Tables are named the same in both databases (see @@map in schema.prisma)
const TABLES = [
    "pendingRecords",
    "acceptedRecords",
    "deniedRecords",
    "recordsToCommit",
    "bulkRecordSessions",
    "bulkRecords",
    "levelsToPlace",
    "levelsToMove",
    "levelsToLegacy",
    "levelsFromLegacy",
    "changelogs",
    "levelsInVoting",
    "messageLocks",
    "staff",
    "shiftMembers",
    "shiftState",
    "levelStats",
    "dailyStats",
    "settings",
    "infos",
    "embeds",
    "messages",
    "submitters",
    "skippers",
    "nextGif",
    "feedbackMsgs"
];

interface PgColumn {
    column_name: string;
    data_type: string;
    is_nullable: "YES" | "NO";
    column_default: string | null;
}

function convert(value: unknown, column: PgColumn): unknown {
    if (value === null || value === undefined) return null;
    switch (column.data_type) {
        case "boolean":
            return (
                value === 1 ||
                value === "1" ||
                value === true ||
                value === "true"
            );
        case "integer":
        case "bigint": {
            const number = Number(value);
            return Number.isFinite(number) ? Math.trunc(number) : null;
        }
        case "timestamp without time zone":
        case "timestamp with time zone": {
            const date = new Date(value as string | number);
            return Number.isNaN(date.getTime()) ? null : date.toISOString();
        }
        case "date": {
            const date = new Date(value as string | number);
            return Number.isNaN(date.getTime())
                ? null
                : date.toISOString().slice(0, 10);
        }
        default:
            return String(value);
    }
}

async function main() {
    const sqlitePath = process.argv[2] ?? "./data/database.sqlite";
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

    const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
    const client = new pg.Client({
        connectionString: process.env.DATABASE_URL
    });
    await client.connect();

    const sqliteTables = new Set(
        (
            sqlite
                .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
                .all() as { name: string }[]
        ).map((row) => row.name)
    );

    // Refuse to import twice
    for (const table of TABLES) {
        const { rows } = await client.query(
            `SELECT COUNT(*)::int AS count FROM "${table}"`
        );
        if (rows[0].count > 0)
            throw new Error(
                `Table "${table}" already has data; import into an empty database`
            );
    }

    try {
        await client.query("BEGIN");
        for (const table of TABLES) {
            if (!sqliteTables.has(table)) {
                console.log(`- ${table}: not in the SQLite database, skipping`);
                continue;
            }

            const { rows: columns } = await client.query<PgColumn>(
                `SELECT column_name, data_type, is_nullable, column_default
                 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = $1`,
                [table]
            );
            const sourceRows = sqlite
                .prepare(`SELECT * FROM "${table}"`)
                .all() as Record<string, unknown>[];

            let imported = 0;
            let skipped = 0;
            for (const sourceRow of sourceRows) {
                const values: Record<string, unknown> = {};
                for (const column of columns) {
                    if (column.column_name in sourceRow)
                        values[column.column_name] = convert(
                            sourceRow[column.column_name],
                            column
                        );
                }
                values.updatedAt ??=
                    values.createdAt ?? new Date().toISOString();

                // Rows missing a now-required value can't be imported
                const missing = columns.find(
                    (column) =>
                        column.is_nullable === "NO" &&
                        column.column_default === null &&
                        values[column.column_name] == null
                );
                if (missing) {
                    console.warn(
                        `  ${table}#${sourceRow.id}: missing "${missing.column_name}", skipping`
                    );
                    skipped++;
                    continue;
                }
                for (const [key, value] of Object.entries(values))
                    if (value === null) delete values[key];

                const keys = Object.keys(values);
                const result = await client.query(
                    `INSERT INTO "${table}" (${keys.map((key) => `"${key}"`).join(", ")})
                     VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")})
                     ON CONFLICT DO NOTHING`,
                    Object.values(values)
                );
                if (result.rowCount) imported++;
                else {
                    console.warn(
                        `  ${table}#${sourceRow.id}: duplicate unique value, skipping`
                    );
                    skipped++;
                }
            }

            // Keep autoincrement ids in sync with the imported rows
            await client.query(
                `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM "${table}"`
            );
            console.log(
                `- ${table}: imported ${imported}/${sourceRows.length}${skipped ? ` (${skipped} skipped)` : ""}`
            );
        }
        await client.query("COMMIT");
        console.log("Import complete");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        await client.end();
        sqlite.close();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
