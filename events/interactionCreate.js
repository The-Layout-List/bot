const { Events } = require("discord.js");
const { Collection } = require("discord.js");
const { guildId } = require("../config.json");
const logger = require("log4js").getLogger();

const ERROR_COMMAND = ":x: There was an error while executing this command.";
const ERROR_BUTTON = ":x: There was an error while executing this button.";
const ERROR_MENU = ":x: There was an error while executing this menu.";
const ERROR_MODAL = ":x: There was an error while executing this modal.";

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isChatInputCommand()) {
            // Chat command //

            if (interaction.guildId !== guildId) {
                return interaction.reply({
                    content:
                        "Hey!!! This bot is for the Layout List discord only, please kick it from this server. No commands will work. Thanks!",
                    ephemeral: true,
                });
            }

            // Check command's name
            const command = interaction.client.commands.get(
                interaction.commandName
            );

            if (!command) {
                logger.error(
                    `No command matching ${interaction.commandName} was found.`
                );
                return;
            }

            const { cooldowns } = interaction.client;

            // Check if there's a cooldown
            if (!cooldowns.has(command.data.name)) {
                cooldowns.set(command.data.name, new Collection());
            }

            const now = Date.now();
            const timestamps = cooldowns.get(command.data.name);
            const defaultCooldownDuration = 3;
            const cooldownAmount =
                (command.cooldown ?? defaultCooldownDuration) * 1000;

            if (timestamps.has(interaction.user.id)) {
                const expirationTime =
                    timestamps.get(interaction.user.id) + cooldownAmount;

                if (now < expirationTime) {
                    const expiredTimestamp = Math.round(expirationTime / 1000);
                    return interaction.reply({
                        content: `Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`,
                        ephemeral: true,
                    });
                }
            }

            timestamps.set(interaction.user.id, now);
            setTimeout(
                () => timestamps.delete(interaction.user.id),
                cooldownAmount
            );

            // Execute command
            try {
                const optionsToLog = interaction.options.data.filter(
                    (op) => op.type !== 1
                );
                logger.log(
                    `User ${interaction.user.username} (${
                        interaction.user.id
                    }) executed /${interaction.commandName} ${
                        interaction.options.getSubcommand(false) || ""
                    }${
                        optionsToLog.length > 0
                            ? ` \nOptions: ${JSON.stringify(optionsToLog)}`
                            : ""
                    }`
                );
                await command.execute(interaction);
            } catch (error) {
                logger.error(`Error executing ${interaction.commandName}`);
                logger.error(error);
                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.editReply({
                            content: ERROR_COMMAND,
                        });
                    } else {
                        await interaction.reply({
                            content: ERROR_COMMAND,
                            ephemeral: true,
                        });
                    }
                } catch (replyError) {
                    logger.error(
                        "Failed to send error response to user:",
                        replyError
                    );
                }
            }
        } else if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(
                interaction.commandName
            );

            if (!command) {
                logger.error(
                    `No command matching ${interaction.commandName} was found.`
                );
                return;
            }

            try {
                await command.autocomplete(interaction);
            } catch (error) {
                logger.error(error);
                try {
                    await interaction.respond([]);
                } catch (replyError) {
                    logger.error(
                        "Failed to send error response to user:",
                        replyError
                    );
                }
            }
        } else if (interaction.isContextMenuCommand()) {
            await interaction.deferReply({
                ephemeral: true,
            });
            const command = interaction.client.commands.get(
                interaction.commandName
            );

            if (!command) {
                logger.error(
                    `No command matching ${interaction.commandName} was found.`
                );
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                logger.error(error);
                try {
                    await interaction.editReply({
                        content: ERROR_COMMAND,
                    });
                } catch (replyError) {
                    logger.error(
                        "Failed to send error response to user:",
                        replyError
                    );
                }
            }
        } else if (interaction.isButton()) {
            // Handle button interactions //
            const button = interaction.client.buttons.get(interaction.customId);
            if (button) {
                // Execute code
                try {
                    if (button.ephemeral != null)
                        await interaction.deferReply({
                            ephemeral: button.ephemeral,
                        });
                    await button.execute(interaction);
                } catch (error) {
                    logger.error(`Error executing ${interaction.customId}`);
                    logger.error(error);
                    try {
                        if (interaction.replied || interaction.deferred) {
                            await interaction.editReply({
                                content: ERROR_BUTTON,
                            });
                        } else {
                            await interaction.reply({
                                content: ERROR_BUTTON,
                                ephemeral: true,
                            });
                        }
                    } catch (replyError) {
                        logger.error(
                            "Failed to send error response to user:",
                            replyError
                        );
                    }
                }
            }
        } else if (interaction.isAnySelectMenu()) {
            // Handle select menus
            await interaction.deferReply({ ephemeral: true });

            const menu = interaction.client.menus.get(interaction.customId);
            if (menu) {
                // Execute code
                try {
                    await menu.execute(interaction);
                } catch (error) {
                    logger.error(`Error executing ${interaction.customId}`);
                    logger.error(error);
                    try {
                        await interaction.editReply({
                            content: ERROR_MENU,
                        });
                    } catch (replyError) {
                        logger.error(
                            "Failed to send error response to user:",
                            replyError
                        );
                    }
                }
            }
        } else if (interaction.isModalSubmit()) {
            const modal = interaction.client.modals.get(interaction.customId);
            if (modal) {
                // Execute code
                try {
                    await modal.execute(interaction);
                } catch (error) {
                    logger.error(`Error executing ${interaction.customId}`);
                    logger.error(error);
                    try {
                        if (interaction.replied || interaction.deferred) {
                            await interaction.editReply({
                                content: ERROR_MODAL,
                            });
                        } else {
                            await interaction.reply({
                                content: ERROR_MODAL,
                                ephemeral: true,
                            });
                        }
                    } catch (replyError) {
                        logger.error(
                            "Failed to send error response to user:",
                            replyError
                        );
                    }
                }
            }
        } else {
            return;
        }
    },
};
