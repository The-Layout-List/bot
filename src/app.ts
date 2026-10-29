import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { errorLogger, logger } from "./lib/logger";

// Error logging
process.on("uncaughtException", (err) => {
    errorLogger.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
    errorLogger.error("Unhandled Rejection at:", promise, "reason:", reason);
});

logger.info("-".repeat(40));
logger.info("Layout List Bot starting...");
logger.info("-".repeat(40));

// Create a new client instance. CommandKit loads the commands and events
// from src/app and logs the client in with the TOKEN environment variable.
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

export default client;
