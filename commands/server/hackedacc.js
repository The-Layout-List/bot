const { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } = require("discord.js");
const logger = require("log4js").getLogger();
module.exports = {
    enabled: true,
    cooldown: 1,
    data: new SlashCommandBuilder()
        .setName("hackedacc")
        .setDescription("HACKERS BEGONE")
        .addUserOption((option) =>
            option
                .setName("hacker")
                .setDescription("The hacker")
        ),

    /**
     * 
     * @param {ChatInputCommandInteraction} interaction 
     * @returns 
     */
    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const hacker = interaction.options.getUser("hacker");
        if (!hacker) {
            await interaction.editReply(":x: Error retrieving user");
            return;
        }
        const member = await interaction.guild.members.cache.get(hacker.id);
        if (!member) {
            await interaction.editReply(":x: Error retrieving member");
            return;
        }
        if (!interaction.member.permissions.has("BanMembers")) {
            await interaction.editReply(":x: You do not have permission to ban members.");
            return;
        }
        if (!member.bannable) {
            await interaction.editReply(":x: I cannot ban this user");
            return;
        }
        const messages = (await interaction.channel.messages.fetch({ author: hacker.id, limit: 100 })).filter((message) => message.author.id === hacker.id);
        if (messages.size > 0) {
            const message = messages.last();
            if (message) {
                await message.reply("https://media.discordapp.net/attachments/1447594249481879625/1496942499921526834/goldensigma.gif?ex=6a5bc757&is=6a5a75d7&hm=76d2a958c54aad5e2fdf79e4707cd2ea2db02489f4ec029d6678c46840dfd698&=&width=767&height=648")
            }
        }
        await member.ban({ reason: "Hacked account posting scams", deleteMessageSeconds: 86400 });
        await interaction.guild.bans.remove(hacker, "Hacked account auto unban");
        // Log
        return await interaction.editReply(`:white_check_mark: Kicked ${hacker.tag}`);

    },
};
