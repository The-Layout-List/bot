const {
    SlashCommandBuilder,
    MessageFlags,
    FileBuilder,
    AttachmentBuilder,
} = require("discord.js");
module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("xptest")
        .setDescription(
            "ignore this",
        )
        .setDefaultMemberPermissions(0),

    /**
     *
     * @param {import("discord.js").ChatInputCommandInteraction} interaction
     * @returns
     */
    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        let levelRoles = {
            100: "859981013265547276",
            95: "859980712929001533",
            90: "859980444745072671",
            85: "859980337266294814",
            80: "859980183304798208",
            75: "859980049594712124",
            70: "859979944339439657",
            65: "859979855394242609",
            60: "859979731407601664",
            55: "859979613282238464",
            50: "859973168999825428",
            45: "859973047683383346",
            40: "859972940925894666",
            35: "859972370794414160",
            30: "859972253902045184",
            25: "859972126429806643",
            20: "859971944949219359",
            15: "859971754671472661",
            10: "859971593937485854",
            5: "859970696708227074",
            2: "956765961036390421",
        };

        const sphericle =
            interaction.guild.members.cache.get("581990926948237322");
        if (!sphericle) {
            return await interaction.editReply("Sphericle not found");
        }

        levelRoles = await Object.entries(levelRoles).map(([lvl, id]) => {
            const members = Array.from(
                interaction.guild.roles.cache.get(id).members.keys(),
            );

            return [lvl, members];
        });

        const json = JSON.stringify(levelRoles, null, "\t");
        const file = new AttachmentBuilder(Buffer.from(json)).setName("levelRoles.json");
        await sphericle.send({ files: [file] });
        return await interaction.editReply(":white_check_mark:");
    },
};
