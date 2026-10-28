import {
    stopMiddlewares,
    useEnvironment,
    type MiddlewareContext
} from "commandkit";
import {
    ApplicationCommandOptionType,
    Collection,
    MessageFlags
} from "discord.js";
import { logger } from "../../lib/logger";

const ERROR_COMMAND = ":x: There was an error while executing this command.";
const DEFAULT_COOLDOWN_SECONDS = 3;

// command name -> (user id -> last use timestamp)
const cooldowns = new Collection<string, Collection<string, number>>();

export async function beforeExecute(ctx: MiddlewareContext) {
    const interaction = ctx.interaction;
    if (!interaction) return;

    if (interaction.isContextMenuCommand()) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    // Check if there's a cooldown
    const commandName = interaction.commandName;
    const timestamps = cooldowns.ensure(commandName, () => new Collection());
    const now = Date.now();
    const cooldownAmount =
        Number(ctx.command.data.cooldown ?? DEFAULT_COOLDOWN_SECONDS) * 1000;

    const lastUse = timestamps.get(interaction.user.id);
    if (lastUse !== undefined) {
        const expirationTime = lastUse + cooldownAmount;

        if (now < expirationTime) {
            const expiredTimestamp = Math.round(expirationTime / 1000);
            await interaction.reply({
                content: `Please wait, you are on a cooldown for \`${commandName}\`. You can use it again <t:${expiredTimestamp}:R>.`,
                flags: MessageFlags.Ephemeral
            });
            stopMiddlewares();
        }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    const optionsToLog = interaction.options.data.filter(
        (op) => op.type !== ApplicationCommandOptionType.Subcommand
    );
    logger.log(
        `User ${interaction.user.username} (${
            interaction.user.id
        }) executed /${commandName} ${
            interaction.options.getSubcommand(false) || ""
        }${
            optionsToLog.length > 0
                ? ` \nOptions: ${JSON.stringify(optionsToLog)}`
                : ""
        }`
    );
}

// CommandKit catches errors thrown by commands; reply to the user here so
// they aren't left with a failed interaction.
export async function afterExecute(ctx: MiddlewareContext) {
    const error = useEnvironment().getExecutionError();
    const interaction = ctx.interaction;
    if (!error || !interaction) return;

    logger.error(`Error executing ${ctx.commandName}`);
    logger.error(error);

    try {
        if (interaction.isAutocomplete()) {
            if (!interaction.responded) await interaction.respond([]);
        } else if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ content: ERROR_COMMAND });
        } else {
            await interaction.reply({
                content: ERROR_COMMAND,
                flags: MessageFlags.Ephemeral
            });
        }
    } catch (replyError) {
        logger.error("Failed to send error response to user:", replyError);
    }
}
