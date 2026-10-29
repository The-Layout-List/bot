import {
    SlashCommandBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    type ModalSubmitInteraction,
    type MessageComponentInteraction
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
    .setName("message")
    .setDescription("Bot messages management")
    .addSubcommand((subcommand) =>
        subcommand
            .setName("create")
            .setDescription("Creates a new message")
            .addStringOption((option) =>
                option
                    .setName("name")
                    .setDescription(
                        "Internal name of the message, to be able to edit it later"
                    )
                    .setRequired(true)
            )
            .addChannelOption((option) =>
                option
                    .setName("channel")
                    .setDescription("Channel to send the message in")
                    .setRequired(true)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("edit")
            .setDescription("Edit a previously sent message")
            .addStringOption((option) =>
                option
                    .setName("name")
                    .setDescription("Internal name of the message to edit")
                    .setAutocomplete(true)
                    .setRequired(true)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("delete")
            .setDescription("Delete a previously sent message")
            .addStringOption((option) =>
                option
                    .setName("name")
                    .setDescription("Internal name of the message to delete")
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
            await db.message.findMany({
                where: { guild: interaction.guild.id }
            })
        )
            .filter((message) =>
                message.name.toLowerCase().includes(focused.toLowerCase())
            )
            .slice(0, 25)
            .map((message) => ({ name: message.name, value: message.name }))
    );
};

export const chatInput: ChatInputCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "create") {
        const name = interaction.options.getString("name", true);
        const channel = interaction.options.getChannel("channel", true);

        if (
            await db.message.findFirst({
                where: { name: name, guild: interaction.guild.id }
            })
        ) {
            return await interaction.reply({
                content:
                    ":x: A message with that name already exists in this server",
                flags: MessageFlags.Ephemeral
            });
        }

        const channelResolved = interaction.guild.channels.cache.get(
            channel.id
        );
        if (!channelResolved?.isTextBased()) {
            return await interaction.reply({
                content: ":x: Invalid channel",
                flags: MessageFlags.Ephemeral
            });
        }

        const modal = new ModalBuilder()
            .setCustomId("messageContentModal")
            .setTitle("Enter Message Content");

        const contentInput = new TextInputBuilder()
            .setCustomId("contentInput")
            .setLabel("Message Content")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(2000);

        const modalRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
            contentInput
        );
        modal.addComponents(modalRow);

        await interaction.showModal(modal);

        const filter = (i: ModalSubmitInteraction) =>
            i.customId === "messageContentModal" &&
            i.user.id === interaction.user.id;
        const submittedModal = await interaction
            .awaitModalSubmit({ filter, time: 60_000 })
            .catch(() => null);

        if (!submittedModal) {
            return await interaction.followUp({
                content:
                    ":x: No response received within the time limit. Action cancelled.",
                flags: MessageFlags.Ephemeral
            });
        }

        const content = submittedModal.fields.getTextInputValue("contentInput");

        const confirm = new ButtonBuilder()
            .setCustomId("confirm")
            .setLabel("Send Message")
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
                await submittedModal.reply({
                    content: content,
                    components: [row],
                    flags: MessageFlags.Ephemeral,
                    withResponse: true
                })
            ).resource!.message!;
        } catch (error) {
            logger.error(`Failed to create the message preview: ${error}`);
            return await submittedModal.reply({
                content: `:x: Failed to create the message preview: ${error}`,
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
                    sent = await channelResolved.send({ content });
                } catch (error) {
                    logger.error(`Failed to send the message: ${error}`);
                    return await confirmation.update({
                        content: `:x: Failed to send the message. Check the bot permissions and try again.`,
                        components: []
                    });
                }

                await db.message.create({
                    data: {
                        name: name,
                        guild: submittedModal.guild.id,
                        channel: channel.id,
                        discordid: sent.id
                    }
                });

                await confirmation.update({
                    content: `:white_check_mark: Message sent successfully`,
                    components: []
                });
            } else if (confirmation.customId === "cancel") {
                await confirmation.update({
                    content: ":x: Action cancelled",
                    components: []
                });
            }
        } catch {
            await submittedModal.editReply({
                content:
                    ":x: Confirmation not received within 1 minute, cancelling",
                components: []
            });
        }
    } else if (subcommand === "edit") {
        const name = interaction.options.getString("name", true);

        const messageEntry = await db.message.findFirst({
            where: { name: name, guild: interaction.guild.id }
        });
        if (!messageEntry) {
            return await interaction.reply({
                content: `:x: No message found with the name "${name}"`,
                flags: MessageFlags.Ephemeral
            });
        }

        const channel = interaction.guild.channels.cache.get(
            messageEntry.channel
        );
        if (!channel?.isTextBased()) {
            return await interaction.reply({
                content:
                    ":x: Could not find the channel where the message was sent.",
                flags: MessageFlags.Ephemeral
            });
        }

        const targetMessage = await channel.messages
            .fetch(messageEntry.discordid)
            .catch(() => null);
        if (!targetMessage) {
            return await interaction.reply({
                content:
                    ":x: Could not find the original message to edit. It might have been deleted.",
                flags: MessageFlags.Ephemeral
            });
        }

        const editModal = new ModalBuilder()
            .setCustomId("editMessageModal")
            .setTitle("Edit Message Content");

        const editContentInput = new TextInputBuilder()
            .setCustomId("editContentInput")
            .setLabel("New Message Content")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(2000)
            .setValue(targetMessage.content);

        const editModalRow =
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                editContentInput
            );
        editModal.addComponents(editModalRow);

        await interaction.showModal(editModal);

        const editFilter = (i: ModalSubmitInteraction) =>
            i.customId === "editMessageModal" &&
            i.user.id === interaction.user.id;
        const editSubmittedModal = await interaction
            .awaitModalSubmit({ filter: editFilter, time: 60_000 })
            .catch(() => null);

        if (!editSubmittedModal) {
            return await interaction.followUp({
                content:
                    ":x: No response received within the time limit. Action cancelled.",
                flags: MessageFlags.Ephemeral
            });
        }

        const newContent =
            editSubmittedModal.fields.getTextInputValue("editContentInput");

        const confirm = new ButtonBuilder()
            .setCustomId("confirmEdit")
            .setLabel("Confirm Edit")
            .setStyle(ButtonStyle.Success);

        const cancel = new ButtonBuilder()
            .setCustomId("cancelEdit")
            .setLabel("Cancel Edit")
            .setStyle(ButtonStyle.Danger);

        const editRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            confirm,
            cancel
        );

        let editResponse;
        try {
            editResponse = (
                await editSubmittedModal.reply({
                    content: newContent,
                    components: [editRow],
                    flags: MessageFlags.Ephemeral,
                    withResponse: true
                })
            ).resource!.message!;
        } catch (error) {
            logger.error(
                `Failed to create the edited message preview: ${error}`
            );
            return await editSubmittedModal.reply({
                content: `:x: Failed to create the edited message preview: ${error}`,
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
                await targetMessage.edit({ content: newContent });

                await editConfirmation.update({
                    content: `:white_check_mark: Message edited successfully`,
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

        const messageEntry = await db.message.findFirst({
            where: { name: name, guild: interaction.guild.id }
        });
        if (!messageEntry) {
            return await interaction.reply({
                content: `:x: No message found with the name "${name}"`,
                flags: MessageFlags.Ephemeral
            });
        }

        const channel = interaction.guild.channels.cache.get(
            messageEntry.channel
        );
        if (!channel?.isTextBased()) {
            return await interaction.reply({
                content:
                    ":x: Could not find the channel where the message was sent.",
                flags: MessageFlags.Ephemeral
            });
        }

        const targetMessage = await channel.messages
            .fetch(messageEntry.discordid)
            .catch(() => null);

        try {
            await db.message.deleteMany({
                where: { name: name, guild: interaction.guild.id }
            });
        } catch (error) {
            logger.error(`Failed to delete the message: ${error}`);
            return await interaction.reply({
                content: `:x: Failed to delete the message from the bot: ${error}`,
                flags: MessageFlags.Ephemeral
            });
        }
        try {
            if (!targetMessage) throw new Error("Message not found");
            await targetMessage.delete();
        } catch (error) {
            logger.error(`Failed to delete the message: ${error}`);
            return await interaction.reply({
                content: `:x: Removed the message from the bot, but failed to delete the message (it may have already been deleted): ${error}`,
                flags: MessageFlags.Ephemeral
            });
        }
        await interaction.reply({
            content: `:white_check_mark: Message "${name}" deleted successfully`,
            flags: MessageFlags.Ephemeral
        });
    }
};
