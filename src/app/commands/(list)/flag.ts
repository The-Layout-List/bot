import type { ListFlags } from "../../../lib/listTypes";
import { SlashCommandBuilder, MessageFlags } from "discord.js";
import type {
    AutocompleteCommand,
    ChatInputCommand,
    CommandData,
    CommandMetadata
} from "commandkit";
import { octokit, asFile } from "../../../lib/github";
import { config, commandGuilds } from "../../../lib/config";
import { logger } from "../../../lib/logger";
import flags from "../../../lib/flagmap.json";
import { db } from "../../../lib/db";

const { githubOwner, githubRepo, githubDataPath, githubBranch } = config;

export const command: CommandData = new SlashCommandBuilder()
    .setName("flag")
    .setDescription("Flag/nationality management for the list")
    .addSubcommand((subcommand) =>
        subcommand
            .setName("set")
            .setDescription("Set a user's flag")
            .addStringOption((option) =>
                option
                    .setName("username")
                    .setDescription("The name of the user to set the flag for")
                    .setRequired(true)
                    .setAutocomplete(true)
            )
            .addStringOption((option) =>
                option
                    .setName("flag")
                    .setDescription(
                        "The country to set the user's flag to. Be sure to choose an option above."
                    )
                    .setRequired(true)
                    .setAutocomplete(true)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("remove")
            .setDescription("Remove a user's flag")
            .addStringOption((option) =>
                option
                    .setName("username")
                    .setDescription(
                        "The name of the user to remove the flag for"
                    )
                    .setRequired(true)
                    .setAutocomplete(true)
            )
    )
    .toJSON();

export const metadata: CommandMetadata = { guilds: commandGuilds() };

export const autocomplete: AutocompleteCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    const focused = interaction.options.getFocused(true);

    if (focused.name === "username") {
        const users = await db.cachedUser.findMany({
            where: {
                name: {
                    contains: focused.value.toLowerCase(),
                    mode: "insensitive"
                }
            }
        });
        return await interaction.respond(
            users
                .slice(0, 25)
                .map((user) => ({ name: user.name, value: user.name }))
        );
    } else if (focused.name === "flag") {
        return await interaction.respond(
            Object.entries(flags)
                .filter(([key]) =>
                    key.toLowerCase().includes(focused.value.toLowerCase())
                )
                .slice(0, 25)
                .map(([name, value]) => ({ name, value }))
        );
    }
};

export const chatInput: ChatInputCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "set") {
        const username = interaction.options.getString("username", true);
        const flag = interaction.options.getString("flag", true);

        if (flag.length > 2)
            return await interaction.editReply(
                "Invalid country! Make sure you specifically choose an autocompleted option."
            );

        // fetch github data path / _flags.json
        let fileResponse;
        try {
            fileResponse = await octokit.rest.repos.getContent({
                owner: githubOwner,
                repo: githubRepo,
                path: githubDataPath + `/_flags.json`,
                branch: githubBranch
            });
        } catch (fetchError) {
            logger.info(`Couldn't fetch flags.json: \n${fetchError}`);
            return await interaction.editReply(
                `:x: Couldn't fetch flags.json: \n${fetchError}`
            );
        }

        let parsedData: ListFlags;
        try {
            parsedData = JSON.parse(
                Buffer.from(
                    asFile(fileResponse.data).content,
                    "base64"
                ).toString("utf-8")
            );
        } catch (parseError) {
            logger.info(`Unable to parse flags data:\n${parseError}`);
            return await interaction.editReply(
                `:x: Unable to parse flags data:\n${parseError}`
            );
        }

        if (parsedData[username] === flag)
            return await interaction.editReply(
                `:x: ${username}'s flag is already set to ${flag}`
            );

        parsedData[username] = flag;

        let fileSha;
        try {
            const response = await octokit.repos.getContent({
                owner: githubOwner,
                repo: githubRepo,
                path: githubDataPath + `/_flags.json`
            });
            fileSha = asFile(response.data).sha;
        } catch (error) {
            logger.info(`Error fetching _flags.json SHA:\n${error}`);
            return await interaction.editReply(
                `:x: Couldn't fetch data from _flags.json`
            );
        }
        try {
            await octokit.repos.createOrUpdateFileContents({
                owner: githubOwner,
                repo: githubRepo,
                path: githubDataPath + `/_flags.json`,
                branch: githubBranch,
                message: `Set ${username}'s flag (${interaction.user.tag})`,
                content: Buffer.from(
                    JSON.stringify(parsedData, null, "\t")
                ).toString("base64"),
                sha: fileSha
            });
        } catch (updateError) {
            logger.info(`Couldn't update flags.json: \n${updateError}`);
            return await interaction.editReply(
                `:x: Couldn't update flags.json: \n${updateError}`
            );
        }

        return await interaction.editReply(
            `:white_check_mark: Successfully set ${username}'s flag to ${flag}`
        );
    } else if (subcommand === "remove") {
        const username = interaction.options.getString("username", true);

        // fetch github data path / _flags.json
        let fileResponse;
        try {
            fileResponse = await octokit.rest.repos.getContent({
                owner: githubOwner,
                repo: githubRepo,
                path: githubDataPath + `/_flags.json`,
                branch: githubBranch
            });
        } catch (fetchError) {
            logger.info(`Couldn't fetch flags.json: \n${fetchError}`);
            return await interaction.editReply(
                `:x: Couldn't fetch flags.json: \n${fetchError}`
            );
        }

        let parsedData: ListFlags;
        try {
            parsedData = JSON.parse(
                Buffer.from(
                    asFile(fileResponse.data).content,
                    "base64"
                ).toString("utf-8")
            );
        } catch (parseError) {
            logger.info(`Unable to parse flags data:\n${parseError}`);
            return await interaction.editReply(
                `:x: Unable to parse flags data:\n${parseError}`
            );
        }
        if (!parsedData[username])
            return await interaction.editReply(
                `:x: ${username} doesn't have a flag!`
            );
        // remove entry in json
        delete parsedData[username];

        let fileSha;
        try {
            const response = await octokit.repos.getContent({
                owner: githubOwner,
                repo: githubRepo,
                path: githubDataPath + `/_flags.json`
            });
            fileSha = asFile(response.data).sha;
        } catch (error) {
            logger.info(`Error fetching _flags.json SHA:\n${error}`);
            return await interaction.editReply(
                `:x: Couldn't fetch data from _flags.json`
            );
        }
        try {
            await octokit.repos.createOrUpdateFileContents({
                owner: githubOwner,
                repo: githubRepo,
                path: githubDataPath + `/_flags.json`,
                branch: githubBranch,
                message: `Delete ${username}'s flag (${interaction.user.tag})`,
                content: Buffer.from(
                    JSON.stringify(parsedData, null, "\t")
                ).toString("base64"),
                sha: fileSha
            });
        } catch (updateError) {
            logger.info(`Couldn't update flags.json: \n${updateError}`);
            return await interaction.editReply(
                `:x: Couldn't update flags.json: \n${updateError}`
            );
        }

        return await interaction.editReply(
            `:white_check_mark: Successfully removed ${username}'s flag`
        );
    }
};
