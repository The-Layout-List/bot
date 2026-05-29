const simpleGit = require("simple-git");
const log4js = require("log4js");
const Sequelize = require("sequelize");
const { Client, GatewayIntentBits, ActivityType } = require("discord.js");
const { Octokit } = require("@octokit/rest");
const { createDbSchema, createCacheDbSchema } = require("./others/dbSchema.js");
const { parseUsers } = require("./others/gitUtils.js");
const {
    clientInit,
    sequelizeInit,
    checkGithubPermissions,
} = require("./startUtils.js");
const dotenv = require("dotenv");

dotenv.config({ quiet: true });

// Logger
log4js.configure("./log4js.json");
const logger = log4js.getLogger();
const sqlLogger = log4js.getLogger("sql");
const errorLogger = log4js.getLogger("error");

// Error logging
process.on("uncaughtException", (err) => {
    errorLogger.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
    errorLogger.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
    ],
});

// Establish DB connection
const sequelize = new Sequelize({
    dialect: "sqlite",
    logging: (msg) => sqlLogger.debug(msg),
    storage: "./data/database.sqlite",
    define: {
        freezeTableName: true
    }
});

const sequelize_cache = new Sequelize({
    dialect: "sqlite",
    logging: (msg) => sqlLogger.debug(msg),
    storage: "./data/cache.sqlite",
    define: {
        freezeTableName: true
    }
});

// Establish Github connection
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// Git repo setup
const git = simpleGit();

// Create tables models
const db = createDbSchema(sequelize);
const cache = createCacheDbSchema(sequelize_cache);

module.exports = { db, cache, octokit, client, sequelize, git };

async function start() {
    logger.info("-".repeat(40));
    logger.info("Layout List Bot starting...");
    logger.info("-".repeat(40));
    try {
        await sequelizeInit(db, cache);
    } catch (error) {
        logger.error("Unable to sync database data: \n", error);
        process.exit(1);
    }
    try {
        await clientInit(client);
    } catch (error) {
        logger.error("Unable to initialize client: \n", error);
        process.exit(1);
    }
    await checkGithubPermissions(octokit);
    try {
        logger.info("Logging in client with discord...");
        await client.login(process.env.TOKEN);
        logger.info(`Client logged in as ${client.user.username}`);
    } catch (error) {
        logger.error("Unable to login client: \n", error);
        process.exit(1);
    }
    try {
        logger.info("Updating cache...");
        let result = await parseUsers();
        if (typeof result === "string") throw new Error(result);
        if (result === 404) logger.info("No new users.");
    } catch (e) {
        logger.error(e);
    }

    try {
        client.user.setPresence({
            activities: [
                {
                    name: "layouts",
                    type: ActivityType.Playing,
                },
            ],
            status: "online",
        });
    } catch (e) {
        logger.error(`Error setting presence: ${e}`);
    }
}

start();
