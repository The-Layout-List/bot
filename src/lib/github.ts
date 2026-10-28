import { Octokit, type RestEndpointMethodTypes } from "@octokit/rest";
import { simpleGit } from "simple-git";

// Github API connection
export const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// Local clone of the list repository
export const git = simpleGit();

type ContentData =
    RestEndpointMethodTypes["repos"]["getContent"]["response"]["data"];

/** Narrows a `repos.getContent` response to a single file */
export function asFile(data: ContentData) {
    if (Array.isArray(data) || data.type !== "file")
        throw new Error("Expected a file in the github API response");
    return data;
}
