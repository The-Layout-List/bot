import { MessageFlags, type Interaction } from "discord.js";
import { buttons, modals } from "../../../components";
import { logger } from "../../../lib/logger";

// Slash commands, context menus and autocomplete are handled by CommandKit
// (see src/app/commands/+global-middleware.ts); this routes the bot's
// persistent buttons and modals by custom id.

const ERROR_BUTTON = ":x: There was an error while executing this button.";
const ERROR_MODAL = ":x: There was an error while executing this modal.";

export default async function (interaction: Interaction) {
    if (interaction.isButton()) {
        const button = buttons.get(interaction.customId);
        if (!button) return;

        try {
            if (button.ephemeral != null)
                await interaction.deferReply({
                    flags: button.ephemeral ? MessageFlags.Ephemeral : undefined
                });
            await button.execute(interaction);
        } catch (error) {
            logger.error(`Error executing ${interaction.customId}`);
            logger.error(error);
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply({ content: ERROR_BUTTON });
                } else {
                    await interaction.reply({
                        content: ERROR_BUTTON,
                        flags: MessageFlags.Ephemeral
                    });
                }
            } catch (replyError) {
                logger.error(
                    "Failed to send error response to user:",
                    replyError
                );
            }
        }
    } else if (interaction.isModalSubmit()) {
        const modal = modals.get(interaction.customId);
        if (!modal) return;

        try {
            await modal.execute(interaction);
        } catch (error) {
            logger.error(`Error executing ${interaction.customId}`);
            logger.error(error);
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply({ content: ERROR_MODAL });
                } else {
                    await interaction.reply({
                        content: ERROR_MODAL,
                        flags: MessageFlags.Ephemeral
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
}
