import type { Octokit } from "@octokit/rest";
import { config } from "./config";
import { db } from "./db";
import { logger } from "./logger";

const { githubOwner, githubRepo } = config;

/** Creates the singleton rows the bot expects to exist */
export async function ensureDatabaseDefaults(): Promise<void> {
    logger.info("Checking database defaults...");

    // Create infos if they don't exist
    for (const name of ["records", "commitdebug", "shifts"]) {
        const existing = await db.info.findUnique({ where: { name } });
        if (!existing) {
            logger.info(`${name} status not found, creating...`);
            await db.info.create({ data: { name, status: false } });
        }
    }
    if (!(await db.levelStats.count())) {
        logger.info("Level stats data not found, creating");
        await db.levelStats.create({
            data: { submissions: 0, accepts: 0, denies: 0 }
        });
    }
    if (!(await db.shiftState.count())) {
        logger.info("Shift state not found, creating");
        await db.shiftState.create({
            data: {
                id: 1,
                pendingCount: 0,
                weekStartedAt: new Date(),
                reminder5Sent: false,
                reminder6Sent: false
            }
        });
    }

    logger.info("Database defaults check done");
}

export async function checkGithubPermissions(octokit: Octokit): Promise<void> {
    logger.info(
        `Checking github token permissions for ${githubOwner}/${githubRepo}...`
    );
    try {
        const { data } = await octokit.rest.repos.get({
            owner: githubOwner,
            repo: githubRepo
        });

        if (data.permissions?.push) {
            logger.info(`Found push access to ${githubOwner}/${githubRepo}`);
        } else {
            logger.info(
                `Couldn't find push access to ${githubOwner}/${githubRepo}`
            );
        }
    } catch (error) {
        logger.info(`Error fetching repository information: ${error}`);
    }
}

export function shuffle<T>(array: T[]): T[] {
    // For more info, visit https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array.
    let currentIndex = array.length,
        randomIndex;

    while (currentIndex != 0) {
        // While there remain elements to shuffle:
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // ...and swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex],
            array[currentIndex]
        ];
    }

    return array;
}
