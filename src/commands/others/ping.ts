import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('botping')
  .setDescription('Bot ping measurements');

export async function execute(interaction: ChatInputCommandInteraction) {
  const sent = await interaction.reply({
    content: 'Pinging...',
    withResponse: true,
    ephemeral: true,
  });

  const message = sent.resource?.message;
  if (!message) {
    await interaction.editReply('Pong!');
    return;
  }

  await interaction.editReply(
    `Pong! ${message.createdTimestamp - interaction.createdTimestamp}ms`,
  );
}

export const enabled = true;
