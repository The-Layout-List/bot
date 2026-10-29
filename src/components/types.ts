import type { ButtonInteraction, ModalSubmitInteraction } from "discord.js";

export interface ButtonHandler {
    customId: string;
    /** If set, the interaction is deferred (with this ephemeral flag) before executing */
    ephemeral?: boolean;
    execute(interaction: ButtonInteraction): Promise<unknown>;
}

export interface ModalHandler {
    customId: string;
    execute(interaction: ModalSubmitInteraction): Promise<unknown>;
}
