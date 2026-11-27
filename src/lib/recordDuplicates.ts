// Shared duplicate-record logic used by every command that adds records to a
// level file in the list repository.
//
// Rules:
// - A player may only have one record per level.
// - If the new record's percent is less than or equal to the player's
//   existing record, the new record is a duplicate and is not added.
// - If the new record's percent is greater, the existing record is removed
//   and the new one is appended to the bottom of the records list.

import fs from "node:fs";
import path from "node:path";
import type { ListLevel, ListRecord } from "./listTypes";

export type AddRecordResult =
    | { status: "added" }
    | { status: "replaced"; previous: ListRecord }
    | { status: "duplicate"; existing: ListRecord };

function normalizeUser(user: string): string {
    return user.trim().toLowerCase();
}

/** Whether two usernames refer to the same player */
export function isSameUser(a: string, b: string): boolean {
    return normalizeUser(a) === normalizeUser(b);
}

/**
 * Returns the player's best existing record on this level, if any.
 */
export function findExistingRecord(
    records: ListRecord[],
    user: string
): ListRecord | undefined {
    let best: ListRecord | undefined;
    for (const record of records) {
        if (typeof record.user !== "string" || !isSameUser(record.user, user))
            continue;
        if (!best || (record.percent ?? 0) > (best.percent ?? 0)) best = record;
    }
    return best;
}

/**
 * Whether a record for `user` at `percent` would be rejected as a duplicate,
 * i.e. the player already has a record at an equal or higher percent.
 * Returns the blocking record, or undefined if the record can be added.
 */
export function findBlockingRecord(
    records: ListRecord[],
    user: string,
    percent: number
): ListRecord | undefined {
    const existing = findExistingRecord(records, user);
    if (existing && (existing.percent ?? 0) >= percent) return existing;
    return undefined;
}

/**
 * Adds `record` to `level.records` (mutating `level`), following the
 * duplicate rules described at the top of this file.
 */
export function addRecordToLevel(
    level: ListLevel,
    record: ListRecord
): AddRecordResult {
    const existing = findExistingRecord(level.records, record.user);
    if (existing && (existing.percent ?? 0) >= record.percent)
        return { status: "duplicate", existing };

    level.records = level.records.filter(
        (fileRecord) =>
            typeof fileRecord.user !== "string" ||
            !isSameUser(fileRecord.user, record.user)
    );
    level.records.push(record);

    return existing
        ? { status: "replaced", previous: existing }
        : { status: "added" };
}

/**
 * Reads a level file from the local clone of the list repository. Returns
 * null if the file is missing or invalid.
 */
export function readLocalLevel(
    repoPath: string,
    levelPath: string
): ListLevel | null {
    try {
        const parsed = JSON.parse(
            fs.readFileSync(
                path.join(repoPath, `data/${levelPath}.json`),
                "utf8"
            )
        );
        if (!parsed || !Array.isArray(parsed.records)) return null;
        return parsed as ListLevel;
    } catch {
        return null;
    }
}
