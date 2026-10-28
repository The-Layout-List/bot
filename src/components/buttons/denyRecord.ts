import {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} from "discord.js";
import type { ButtonHandler } from "../types";

export default {
    customId: "deny",
    async execute(interaction) {
        // Denying a record //

        // Create deny reason modal
        const denyModal = new ModalBuilder()
            .setCustomId("denyReason")
            .setTitle("Deny Reason");

        const denyReasonInput = new TextInputBuilder()
            .setCustomId("denyReasonInput")
            .setLabel("Why was this record denied?")
            .setMinLength(1)
            .setMaxLength(1000)
            .setPlaceholder("Enter a deny reason")
            .setRequired(true)
            .setStyle(TextInputStyle.Short);

        denyModal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                denyReasonInput
            )
        );

        await interaction.showModal(denyModal);
    }
} satisfies ButtonHandler;
