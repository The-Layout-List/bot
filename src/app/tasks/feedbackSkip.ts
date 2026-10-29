import { EmbedBuilder } from "discord.js";
import { config } from "../../lib/config";
import { db } from "../../lib/db";
import { scheduledTask } from "../../lib/tasks";

const { clientId } = config;
const hours = 4;

export default scheduledTask({
    name: "feedbackSkip",
    schedule: `0 */${hours} * * *`,
    async execute(client) {
        const embed = new EmbedBuilder()
            .setColor(0x34c3eb)
            .setTitle("Scheduled reminder")
            .setDescription(
                "No skipping please! Make sure everyone has gotten feedback before you post. Skipping 3 times = ban from feedback channels."
            )
            .setFooter({
                text: "This message is automatically sent every 4 hours."
            });

        const dbMessages = await db.feedbackMsg.findMany();
        for (const dbMessage of dbMessages) {
            if (!dbMessage.feedbackId) continue;
            const channel = client.channels.cache.get(dbMessage.feedbackId);
            if (!channel?.isTextBased() || !channel.isSendable()) continue;
            const messages = await channel.messages.fetch({ limit: 10 });

            if (messages.some((message) => message.author.id === clientId))
                return;

            if (dbMessage.messageId) {
                const message = await channel.messages.fetch(
                    dbMessage.messageId
                );
                await message.delete();
            }

            const sentMessage = await channel.send({ embeds: [embed] });

            await db.feedbackMsg.update({
                where: { id: dbMessage.id },
                data: { messageId: sentMessage.id }
            });
        }
    }
});
