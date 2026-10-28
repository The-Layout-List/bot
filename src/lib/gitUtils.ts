import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import { db } from "./db";
import { git } from "./github";
import { logger } from "./logger";

/** Path to the local clone of the list repository */
export const localRepoPath = path.resolve(process.cwd(), "data/repo/");

export interface ParsedLevel {
    name: string;
    position: number;
    filename: string;
}

export async function cloneOrPullRepo(): Promise<void | -1> {
    try {
        const { githubOwner, githubRepo } = config;

        if (!fs.existsSync(localRepoPath)) {
            logger.info(
                "Git - " +
                    "Cloning the repository for the first time, this may take a while..."
            );
            await git.clone(
                `https://github.com/${githubOwner}/${githubRepo}.git`,
                localRepoPath
            );
        } else {
            await git.cwd(localRepoPath).pull();
        }
    } catch (error) {
        logger.error("Git - " + `Error updating the repository:\n${error}`);
        return -1;
    }
}

export async function parseLevels(
    useLegacy?: boolean
): Promise<ParsedLevel[] | -1> {
    await cloneOrPullRepo();
    const levels: ParsedLevel[] = [];
    const listFilename = useLegacy ? "data/_legacy.json" : "data/_list.json";
    let list_data: string[];
    try {
        list_data = JSON.parse(
            fs.readFileSync(path.join(localRepoPath, listFilename), "utf8")
        );
    } catch (parseError) {
        if (!listFilename.startsWith("_"))
            logger.error(
                "Git - " +
                    `Unable to parse data from ${listFilename}:\n${parseError}`
            );
        return -1;
    }

    let i = 1;
    for (const filename of list_data) {
        let parsedData;
        try {
            parsedData = JSON.parse(
                fs.readFileSync(
                    path.join(localRepoPath, `data/${filename}.json`),
                    "utf8"
                )
            );
        } catch (parseError) {
            if (!filename.startsWith("_"))
                logger.error(
                    "Git - " +
                        `Unable to parse data from ${filename}.json:\n${parseError}`
                );
            continue;
        }

        levels.push({
            name: parsedData.name,
            position: i,
            filename: filename
        });
        i++;
    }
    return levels;
}

export async function parseUsers(useLegacy?: boolean): Promise<200 | string> {
    const userset = new Set<string>();
    const listFilename = useLegacy ? "data/_legacy.json" : "data/_list.json";
    let list_data: string[];
    try {
        list_data = JSON.parse(
            fs.readFileSync(path.join(localRepoPath, listFilename), "utf8")
        );
    } catch (parseError) {
        return (
            "Git - " +
            `Unable to parse data from ${listFilename}:\n${parseError}`
        );
    }

    for (const filename of list_data) {
        let parsedData;
        try {
            if (filename.startsWith("_")) continue;
            parsedData = JSON.parse(
                fs.readFileSync(
                    path.join(localRepoPath, `data/${filename}.json`),
                    "utf8"
                )
            );
            if (parsedData.name.startsWith("_")) continue;

            userset.add(parsedData.verifier);
            for (const creator of parsedData.creators) userset.add(creator);
            for (const record of parsedData.records) userset.add(record.user);
        } catch (parseError) {
            logger.error(
                "Git - " +
                    `Unable to parse data from ${filename}.json:\n${parseError}`
            );
            continue;
        }
    }

    const users = Array.from(userset);

    try {
        const usersObj = users.map((user, index) => {
            return {
                name: user,
                user_id: String(index)
            };
        });

        await db.$transaction([
            db.cachedUser.deleteMany(),
            db.cachedUser.createMany({ data: usersObj })
        ]);
    } catch (error) {
        return `Couldn't add users, something went wrong with prisma: ${error}`;
    }
    return 200;
}
