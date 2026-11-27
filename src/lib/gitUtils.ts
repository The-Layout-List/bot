import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import { db } from "./db";
import { simpleGit } from "simple-git";
import { git } from "./github";
import { logger } from "./logger";

/** Path to the local clone of the list repository */
export const localRepoPath = path.resolve(process.cwd(), "data/repo/");

export interface ParsedLevel {
    name: string;
    position: number;
    filename: string;
}

async function cloneRepo(remoteUrl: string, branch: string): Promise<void> {
    logger.info(
        "Git - " +
            "Cloning the repository for the first time, this may take a while..."
    );
    await git.clone(remoteUrl, localRepoPath, ["--branch", branch]);
}

/**
 * Makes the local clone an exact copy of the configured branch on GitHub.
 * The bot never commits to the local clone (all writes go through the GitHub
 * API), so instead of pulling (which fails when the remote history was reset
 * or force-pushed), local state is discarded and replaced with the remote's.
 */
async function syncRepo(remoteUrl: string, branch: string): Promise<void> {
    const repo = simpleGit(localRepoPath);
    // Follow config changes (e.g. switching between the real and test repo)
    await repo.remote(["set-url", "origin", remoteUrl]);
    await repo.fetch("origin", branch);
    await repo.raw(["checkout", "--force", "-B", branch, "FETCH_HEAD"]);
    await repo.clean("f", ["-d"]);
}

export async function cloneOrPullRepo(): Promise<void | -1> {
    const { githubOwner, githubRepo, githubBranch } = config;
    const remoteUrl = `https://github.com/${githubOwner}/${githubRepo}.git`;
    try {
        if (!fs.existsSync(localRepoPath)) {
            await cloneRepo(remoteUrl, githubBranch);
            return;
        }
        try {
            await syncRepo(remoteUrl, githubBranch);
        } catch (syncError) {
            // The local clone is broken (e.g. a half-finished clone), start over
            logger.warn(
                "Git - " +
                    `Couldn't update the local repository, re-cloning it:\n${syncError}`
            );
            fs.rmSync(localRepoPath, { recursive: true, force: true });
            await cloneRepo(remoteUrl, githubBranch);
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
