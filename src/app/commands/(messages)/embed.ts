import {
    SlashCommandBuilder,
    resolveColor,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    type ModalSubmitInteraction,
    type MessageComponentInteraction,
    type ColorResolvable
} from "discord.js";
import type {
    AutocompleteCommand,
    ChatInputCommand,
    CommandData,
    CommandMetadata
} from "commandkit";
import { logger } from "../../../lib/logger";
import { db } from "../../../lib/db";
import { commandGuilds } from "../../../lib/config";

export const cooldown = 5;

export const command: CommandData = new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Bot embed messages management")
    .addSubcommand((subcommand) =>
        subcommand
            .setName("create")
            .setDescription("Creates a new embed message")
            .addStringOption((option) =>
                option
                    .setName("name")
                    .setDescription(
                        "Internal name of the embed, to be able to edit it later"
                    )
                    .setRequired(true)
            )
            .addChannelOption((option) =>
                option
                    .setName("channel")
                    .setDescription("Channel to send the embed in")
                    .setRequired(true)
            )
            .addStringOption((option) =>
                option
                    .setName("title")
                    .setDescription("Title of the embed")
                    .setMaxLength(256)
            )
            .addStringOption((option) =>
                option.setName("color").setDescription("Embed color")
            )
            .addAttachmentOption((option) =>
                option.setName("image").setDescription("Embed image")
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("edit")
            .setDescription("Edit a previously sent embed message")
            .addStringOption((option) =>
                option
                    .setName("name")
                    .setDescription("Internal name of the embed to edit")
                    .setAutocomplete(true)
                    .setRequired(true)
            )
            .addStringOption((option) =>
                option
                    .setName("title")
                    .setDescription("New title of the embed")
                    .setMaxLength(256)
            )
            .addStringOption((option) =>
                option.setName("color").setDescription("New color of the embed")
            )
            .addAttachmentOption((option) =>
                option.setName("image").setDescription("New image of the embed")
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("delete")
            .setDescription("Delete a previously sent embed message")
            .addStringOption((option) =>
                option
                    .setName("name")
                    .setDescription("Internal name of the embed to delete")
                    .setAutocomplete(true)
                    .setRequired(true)
            )
    )
    .toJSON();

export const metadata: CommandMetadata = { guilds: commandGuilds() };

export const autocomplete: AutocompleteCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    const focused = interaction.options.getFocused();
    return await interaction.respond(
        (
            await db.embed.findMany({
                where: { guild: interaction.guild.id }
            })
        )
            .filter((embed) =>
                embed.name.toLowerCase().includes(focused.toLowerCase())
            )
            .slice(0, 25)
            .map((embed) => ({ name: embed.name, value: embed.name }))
    );
};

export const chatInput: ChatInputCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "create") {
        const name = interaction.options.getString("name", true);
        const channel = interaction.options.getChannel("channel", true);
        const title = interaction.options.getString("title");
        const color = interaction.options.getString("color");
        const image = interaction.options.getAttachment("image");

        if (
            await db.embed.findFirst({
                where: { name: name, guild: interaction.guild.id }
            })
        ) {
            return await interaction.reply({
                content:
                    ":x: An embed with that name already exists in this server",
                flags: MessageFlags.Ephemeral
            });
        }

        let colorResolved;
        if (color) {
            try {
                colorResolved = resolveColor(color as ColorResolvable);
                if (!colorResolved)
                    return await interaction.reply({
                        content: ":x: Invalid color",
                        flags: MessageFlags.Ephemeral
                    });
            } catch (error) {
                return await interaction.reply({
                    content: `:x: Failed to resolve the color: ${error}`,
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        const channelResolved = interaction.guild.channels.cache.get(
            channel.id
        );
        if (!channelResolved?.isTextBased())
            return await interaction.reply({
                content: ":x: Invalid channel",
                flags: MessageFlags.Ephemeral
            });

        const modal = new ModalBuilder()
            .setCustomId("embedDescriptionModal")
            .setTitle("Enter Embed Description");

        const descriptionInput = new TextInputBuilder()
            .setCustomId("descriptionInput")
            .setLabel("Embed Description (can be empty)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(4000);

        const modalRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
            descriptionInput
        );
        modal.addComponents(modalRow);

        await interaction.showModal(modal);

        const filter = (i: ModalSubmitInteraction) =>
            i.customId === "embedDescriptionModal" &&
            i.user.id === interaction.user.id;
        const submittedModalInteraction = await interaction
            .awaitModalSubmit({ filter, time: 300_000 })
            .catch(() => null);

        let description = null;
        if (submittedModalInteraction) {
            description =
                submittedModalInteraction.fields.getTextInputValue(
                    "descriptionInput"
                );

            if (!title && !description && !image)
                return await submittedModalInteraction.reply({
                    content:
                        ":x: This embed is empty: you must provide at least a title, a description, or an image",
                    flags: MessageFlags.Ephemeral
                });

            const embed = new EmbedBuilder();
            if (title) embed.setTitle(title);
            if (description) embed.setDescription(description);
            embed.setColor(colorResolved ?? "Default");
            try {
                if (image) embed.setImage(image.url);
            } catch (error) {
                logger.error(`Failed to set the image: ${error}`);
                return await submittedModalInteraction.reply({
                    content: `:x: Failed to set the image: ${error}`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const confirm = new ButtonBuilder()
                .setCustomId("confirm")
                .setLabel("Send Embed")
                .setStyle(ButtonStyle.Success);

            const cancel = new ButtonBuilder()
                .setCustomId("cancel")
                .setLabel("Cancel")
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                confirm,
                cancel
            );

            let response;
            try {
                response = (
                    await submittedModalInteraction.reply({
                        content: "Embed preview:",
                        embeds: [embed],
                        components: [row],
                        flags: MessageFlags.Ephemeral,
                        withResponse: true
                    })
                ).resource!.message!;
            } catch (error) {
                logger.error(`Failed to create the embed: ${error}`);
                return await submittedModalInteraction.reply({
                    content: `:x: Failed to create the embed: ${error}`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const collectorFilter = (i: MessageComponentInteraction) =>
                i.user.id === interaction.user.id;
            try {
                const confirmation = await response.awaitMessageComponent({
                    filter: collectorFilter,
                    time: 60_000
                });
                if (confirmation.customId === "confirm") {
                    let sent;
                    try {
                        sent = await channelResolved.send({
                            embeds: [embed]
                        });
                    } catch (error) {
                        logger.error(`Failed to send ${name} embed: ${error}`);
                        return await confirmation.update({
                            content: `:x: Failed to send the embed. Check the bot permissions and try again.`,
                            components: []
                        });
                    }

                    await db.embed.create({
                        data: {
                            name: name,
                            guild: submittedModalInteraction.guild.id,
                            channel: channel.id,
                            discordid: sent.id
                        }
                    });

                    await confirmation.update({
                        content: `:white_check_mark: Embed sent successfully`,
                        components: []
                    });
                } else if (confirmation.customId === "cancel") {
                    await confirmation.update({
                        content: ":x: Action cancelled",
                        components: [],
                        embeds: []
                    });
                }
            } catch {
                await submittedModalInteraction.editReply({
                    content:
                        ":x: Confirmation not received within 1 minute, cancelling",
                    components: [],
                    embeds: []
                });
            }
        }
    } else if (subcommand === "edit") {
        const name = interaction.options.getString("name", true);
        const newTitle = interaction.options.getString("title");
        const color = interaction.options.getString("color");
        const newImage = interaction.options.getAttachment("image");

        const embedEntry = await db.embed.findFirst({
            where: { name: name, guild: interaction.guild.id }
        });
        if (!embedEntry) {
            return await interaction.reply({
                content: `:x: No embed found with the name "${name}"`,
                flags: MessageFlags.Ephemeral
            });
        }

        const channel = interaction.guild.channels.cache.get(
            embedEntry.channel
        );
        if (!channel?.isTextBased()) {
            return await interaction.reply({
                content:
                    ":x: Could not find the channel where the embed was sent.",
                flags: MessageFlags.Ephemeral
            });
        }

        const targetMessage = await channel.messages
            .fetch(embedEntry.discordid)
            .catch(() => null);
        if (!targetMessage) {
            return await interaction.reply({
                content:
                    ":x: Could not find the original embed to edit. It might have been deleted.",
                flags: MessageFlags.Ephemeral
            });
        }

        if (!targetMessage.embeds) {
            return await interaction.reply({
                content: ":x: The target message does not contain an embed.",
                flags: MessageFlags.Ephemeral
            });
        }

        let colorResolved;
        if (color) {
            try {
                colorResolved = resolveColor(color as ColorResolvable);
                if (!colorResolved)
                    return await interaction.reply({
                        content: ":x: Invalid color",
                        flags: MessageFlags.Ephemeral
                    });
            } catch (error) {
                return await interaction.reply({
                    content: `:x: Failed to resolve the color: ${error}`,
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        const editModal = new ModalBuilder()
            .setCustomId("editEmbedModal")
            .setTitle("Edit Embed Content");

        const editDescriptionInput = new TextInputBuilder()
            .setCustomId("editDescriptionInput")
            .setLabel("New Embed Description (can be empty)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(4000)
            .setValue(targetMessage.embeds[0]?.description || "");

        const editModalRow =
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                editDescriptionInput
            );
        editModal.addComponents(editModalRow);

        await interaction.showModal(editModal);

        const editFilter = (i: ModalSubmitInteraction) =>
            i.customId === "editEmbedModal" &&
            i.user.id === interaction.user.id;
        const editSubmittedModal = await interaction
            .awaitModalSubmit({ filter: editFilter, time: 300_000 })
            .catch(() => null);

        if (!editSubmittedModal) {
            return await interaction.followUp({
                content:
                    ":x: No response received within the time limit. Action cancelled.",
                flags: MessageFlags.Ephemeral
            });
        }

        const newDescription = editSubmittedModal.fields.getTextInputValue(
            "editDescriptionInput"
        );

        const updatedEmbed = new EmbedBuilder(targetMessage.embeds[0].toJSON());
        if (newDescription) updatedEmbed.setDescription(newDescription);
        if (newTitle) updatedEmbed.setTitle(newTitle);
        if (newImage) updatedEmbed.setImage(newImage.url);
        if (colorResolved) updatedEmbed.setColor(colorResolved);

        const confirmEdit = new ButtonBuilder()
            .setCustomId("confirmEdit")
            .setLabel("Confirm Edit")
            .setStyle(ButtonStyle.Success);

        const cancelEdit = new ButtonBuilder()
            .setCustomId("cancelEdit")
            .setLabel("Cancel Edit")
            .setStyle(ButtonStyle.Danger);

        const editRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            confirmEdit,
            cancelEdit
        );

        let editResponse;
        try {
            editResponse = (
                await editSubmittedModal.reply({
                    content: "Embed preview (edited):",
                    embeds: [updatedEmbed],
                    components: [editRow],
                    flags: MessageFlags.Ephemeral,
                    withResponse: true
                })
            ).resource!.message!;
        } catch (error) {
            logger.error(`Failed to create the edited embed preview: ${error}`);
            return await editSubmittedModal.reply({
                content: `:x: Failed to create the edited embed preview: ${error}`,
                flags: MessageFlags.Ephemeral
            });
        }

        const editCollectorFilter = (i: MessageComponentInteraction) =>
            i.user.id === interaction.user.id;
        try {
            const editConfirmation = await editResponse.awaitMessageComponent({
                filter: editCollectorFilter,
                time: 60_000
            });

            if (editConfirmation.customId === "confirmEdit") {
                try {
                    await targetMessage.edit({ embeds: [updatedEmbed] });
                } catch (error) {
                    logger.error(`Failed to edit the embed: ${error}`);
                    return await editConfirmation.update({
                        content: `:x: Failed to edit the embed: ${error}`,
                        components: []
                    });
                }

                await editConfirmation.update({
                    content: `:white_check_mark: Embed edited successfully`,
                    components: []
                });
            } else if (editConfirmation.customId === "cancelEdit") {
                await editConfirmation.update({
                    content: ":x: Edit action cancelled",
                    components: []
                });
            }
        } catch {
            await editSubmittedModal.editReply({
                content:
                    ":x: Confirmation not received within 1 minute, cancelling",
                components: []
            });
        }
    } else if (subcommand === "delete") {
        const name = interaction.options.getString("name", true);

        const embedEntry = await db.embed.findFirst({
            where: { name: name, guild: interaction.guild.id }
        });
        if (!embedEntry) {
            return await interaction.reply({
                content: `:x: No embed found with the name "${name}"`,
                flags: MessageFlags.Ephemeral
            });
        }

        const channel = interaction.guild.channels.cache.get(
            embedEntry.channel
        );
        if (!channel?.isTextBased()) {
            return await interaction.reply({
                content:
                    ":x: Could not find the channel where the embed was sent.",
                flags: MessageFlags.Ephemeral
            });
        }

        const targetMessage = await channel.messages
            .fetch(embedEntry.discordid)
            .catch(() => null);

        try {
            await db.embed.deleteMany({
                where: { name: name, guild: interaction.guild.id }
            });
        } catch (error) {
            logger.error(`Failed to delete the embed: ${error}`);
            return await interaction.reply({
                content: `:x: Failed to delete the embed from the bot: ${error}`,
                flags: MessageFlags.Ephemeral
            });
        }
        try {
            if (!targetMessage) throw new Error("Message not found");
            await targetMessage.delete();
        } catch (error) {
            logger.error(`Failed to delete the embed: ${error}`);
            return await interaction.reply({
                content: `:x: Removed the embed from the bot, but failed to delete the message (it may have already been deleted): ${error}`,
                flags: MessageFlags.Ephemeral
            });
        }
        await interaction.reply({
            content: `:white_check_mark: Embed "${name}" deleted successfully`,
            flags: MessageFlags.Ephemeral
        });
    }
};
