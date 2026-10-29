import { SlashCommandBuilder } from "discord.js";
import type {
    ChatInputCommand,
    CommandData,
    CommandMetadata
} from "commandkit";
import { logger } from "../../../lib/logger";
import { db } from "../../../lib/db";
import { commandGuilds } from "../../../lib/config";
interface TenorSearchResult {
    results: { url: string; content_description?: string }[];
    next: string;
}

export const cooldown = 1;

export const command: CommandData = new SlashCommandBuilder()
    .setName("randomgif")
    .setDescription("Get a random gif from Tenor")
    .addStringOption((option) =>
        option
            .setName("search")
            .setDescription("Text to search Tenor's gifs for")
    )
    .toJSON();

export const metadata: CommandMetadata = { guilds: commandGuilds() };

export const chatInput: ChatInputCommand = async ({ interaction }) => {
    if (!interaction.inCachedGuild()) return;
    await interaction.deferReply();
    // find the stored nextVal in the db
    const values = await db.nextGif.findMany();
    const nextVal = values[0];
    if (values.length > 1) {
        await db.nextGif.deleteMany({ where: {} });
    }
    const search = interaction.options.getString("search") || null;
    let url =
        "https://g.tenor.com/v1/search?key=LIVDSRZULELA&limit=20&contentfilter=medium";
    if (search) {
        const encodedSearch = encodeURIComponent(search); // filter unusable characters
        url += `&q=${encodedSearch}`;
    }
    if (nextVal && nextVal.value) {
        url += `&pos=${nextVal.value}`;
    }
    const req = await fetch(url);
    const result = (await req.json()) as TenorSearchResult;
    if (result.results.length > 0) {
        const randomIndex = Math.floor(Math.random() * result.results.length);
        // pick a random gif from the response and send the url
        const gif = result.results[randomIndex];
        await interaction.editReply(
            gif.content_description
                ? `-# [${gif.content_description}](${gif.url})`
                : gif.url
        );

        // randomly update the nextVal offset for the tenor api
        // https://tenor.com/gifapi/documentation#endpoints-search
        if (!nextVal || values.length > 1) {
            await db.nextGif.create({
                data: {
                    value: result.next
                }
            });
        } else if (randomIndex % 4 === 0 && !search) {
            await db.nextGif.updateMany({
                where: {},
                data: { value: result.next }
            });
        }
        return;
    } else {
        logger.log("Search failed");
        // redo literally everything (yikes)
        const search = interaction.options.getString("search") || null;
        let url =
            "https://g.tenor.com/v1/search?key=LIVDSRZULELA&limit=20&contentfilter=medium";
        if (search) {
            const encodedSearch = encodeURIComponent(search); // filter unusable characters
            url += `&q=${encodedSearch}`;
        }
        const req = await fetch(url);
        const result = (await req.json()) as TenorSearchResult;
        const randomIndex = Math.floor(Math.random() * result.results.length);
        if (result.results.length === 0) {
            return await interaction.editReply(
                ":x: No results found! Wtf are you even looking up... weirdo..."
            );
        }
        // pick a random gif from the response and send the url
        const gif = result.results[randomIndex];
        await interaction.editReply(
            gif.content_description
                ? `-# [${gif.content_description}](${gif.url})`
                : gif.url
        );

        // randomly update the nextVal offset for the tenor api
        // https://tenor.com/gifapi/documentation#endpoints-search
        // 1 in 5 chance

        await db.nextGif.updateMany({
            where: {},
            data: { value: result.next }
        });
        return;
    }
};
