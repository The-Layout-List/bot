import fs from "node:fs";
import path from "node:path";
import { db } from "./db";
import {
    cloneOrPullRepo,
    localRepoPath,
    parseLevels,
    parseUsers
} from "./gitUtils";
import { logger } from "./logger";

export async function updateCachedLevels(): Promise<void> {
    await cloneOrPullRepo();

    const levels = await parseLevels();

    if (levels !== -1 && levels.length > 0) {
        try {
            await db.$transaction([
                db.cachedLevel.deleteMany(),
                db.cachedLevel.createMany({ data: levels })
            ]);
        } catch (error) {
            logger.error(
                "Scheduled - " +
                    `Couldn't update cached levels, something went wrong with prisma: ${error}`
            );
        }
    } else {
        logger.error(
            "Scheduled - " + "Canceled updating levels cache: no levels found."
        );
    }
}

export async function updateCachedPacks(): Promise<void> {
    const packs: { name: string; difficulty: number; isDiff: boolean }[] = [];

    await cloneOrPullRepo();

    let parsedData;
    try {
        parsedData = JSON.parse(
            fs.readFileSync(
                path.join(localRepoPath, `data/_packs.json`),
                "utf8"
            )
        );
    } catch (parseError) {
        logger.error(
            "Git - " + `Unable to parse data from _packs.json:\n${parseError}`
        );
        return;
    }
    for (const pack of parsedData) {
        packs.push({
            name: pack.name,
            difficulty: pack.difficulty,
            isDiff: pack.levels && pack.levels.length > 0 ? true : false
        });
    }
    try {
        await db.$transaction([
            db.cachedPack.deleteMany(),
            db.cachedPack.createMany({ data: packs })
        ]);
    } catch (error) {
        logger.error(
            `Couldn't update cached packs, something went wrong with prisma: ${error}`
        );
    }
}

export async function updateArchivedLevels(): Promise<void> {
    await cloneOrPullRepo();

    const dirPath = path.join(localRepoPath, "data/archived/");
    const dir = fs.readdirSync(dirPath);
    const levels: {
        name: string;
        position: number | null;
        filename: string;
    }[] = [];
    for (const filename of dir) {
        const level = JSON.parse(
            fs.readFileSync(path.join(dirPath, filename), "utf8")
        );
        levels.push({
            name: level.name,
            position: level.position ?? null,
            filename: filename
        });
    }

    if (levels.length > 0) {
        try {
            await db.$transaction([
                db.cachedArchivedLevel.deleteMany(),
                db.cachedArchivedLevel.createMany({ data: levels })
            ]);
        } catch (error) {
            logger.error(
                "Scheduled - " +
                    `Couldn't update cached levels, something went wrong with prisma: ${error}`
            );
        }
    } else {
        logger.error(
            "Scheduled - " + "Canceled updating levels cache: no levels found."
        );
    }
}

// Former `cache.updateX()` helpers
export const cache = {
    updateLevels: updateCachedLevels,
    updateUsers: parseUsers,
    updatePacks: updateCachedPacks,
    updateArchived: updateArchivedLevels
};
