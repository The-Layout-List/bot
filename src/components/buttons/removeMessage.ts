import { logger } from "../../lib/logger";
import type { ButtonHandler } from "../types";

export default {
    customId: "removeMsg",
    ephemeral: true,
    async execute(interaction) {
        try {
            await interaction.message.delete();
            return await interaction.editReply(
                ":white_check_mark: Message deleted"
            );
        } catch (error) {
            logger.info(error);
            return await interaction.editReply(":x: Something went wrong");
        }
    }
} satisfies ButtonHandler;
