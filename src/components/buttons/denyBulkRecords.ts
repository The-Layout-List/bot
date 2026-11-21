import {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} from "discord.js";
import type { ButtonHandler } from "../types";

export default {
    customId: "denyBulkRecords",
    async execute(interaction) {
        // Ask for a deny reason that applies to every level in the bulk record
        const denyModal = new ModalBuilder()
            .setCustomId("denyBulkRecordsReason")
            .setTitle("Deny All Records");

        const denyReasonInput = new TextInputBuilder()
            .setCustomId("denyReasonInput")
            .setLabel("Why were these records denied?")
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
