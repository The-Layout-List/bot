import { logger } from "../../lib/logger";
import type { ButtonHandler } from "../types";

export default {
    customId: "deleteThread",
    ephemeral: true,
    async execute(interaction) {
        try {
            await interaction.channel?.delete();
        } catch (error) {
            logger.info(error);
            return await interaction.editReply(":x: Something went wrong");
        }
    }
} satisfies ButtonHandler;
