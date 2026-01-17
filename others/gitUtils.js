const fs = require("fs");
const path = require("path");
const logger = require("log4js").getLogger();

async function cloneOrPullRepo() {
    const { git } = require("../index");
    try {
        const { githubOwner, githubRepo } = require("../config.json");
        const localRepoPath = path.resolve(__dirname, `../data/repo/`);

        if (!fs.existsSync(localRepoPath)) {
            logger.info(
                "Git - " +
                    "Cloning the repository for the first time, this may take a while..."
            );
            await git.clone(`https://github.com/${githubOwner}/${githubRepo}.git`, localRepoPath);
        } else {
            await git.cwd(localRepoPath).pull();
        }
    } catch (error) {
        logger.error("Git - " + `Error updating the repository:\n${error}`);
        return -1;
    }
}

module.exports = {
    cloneOrPullRepo,
    async parseLevels(useLegacy) {
        await cloneOrPullRepo();
        const levels = [];
        const localRepoPath = path.resolve(__dirname, `../data/repo/`);
        const listFilename = useLegacy
            ? "data/_legacy.json"
            : "data/_list.json";
        let list_data;
        try {
            list_data = JSON.parse(
                fs.readFileSync(path.join(localRepoPath, listFilename), "utf8")
            );
        } catch (parseError) {
            if (!listFilename.startsWith("_"))
                logger.error(
                    "Git - " +
                        `Unable to parse data from ${listFilename}:\n${parseError}`
                );
            return -1;
        }

        let i = 1;
        for (const filename of list_data) {
            let parsedData;
            try {
                parsedData = JSON.parse(
                    fs.readFileSync(
                        path.join(localRepoPath, `data/${filename}.json`),
                        "utf8"
                    )
                );
            } catch (parseError) {
                if (!filename.startsWith("_"))
                    logger.error(
                        "Git - " +
                            `Unable to parse data from ${filename}.json:\n${parseError}`
                    );
                continue;
            }

            levels.push({
                name: parsedData.name,
                position: i,
                filename: filename,
            });
            i++;
        }
        return levels;
    },

    async parseUsers(useLegacy) {
        const { cache } = require("../index.js");
        const userset = new Set();
        const localRepoPath = path.resolve(__dirname, `../data/repo/`);
        const listFilename = useLegacy
            ? "data/_legacy.json"
            : "data/_list.json";
        let list_data;
        try {
            list_data = JSON.parse(
                fs.readFileSync(path.join(localRepoPath, listFilename), "utf8")
            );
        } catch (parseError) {
            if (!listFilename.startsWith("_"))
                return (
                    "Git - " +
                    `Unable to parse data from ${listFilename}:\n${parseError}`
                );
        }

        for (const filename of list_data) {
            let parsedData;
            try {
                if (filename.startsWith("_")) continue;
                parsedData = JSON.parse(
                    fs.readFileSync(
                        path.join(localRepoPath, `data/${filename}.json`),
                        "utf8"
                    )
                );
                if (parsedData.name.startsWith("_")) continue;

                userset.add(parsedData.verifier);
                for (const creator of parsedData.creators) userset.add(creator);
                for (const record of parsedData.records)
                    userset.add(record.user);
            } catch (parseError) {
                logger.error(
                    "Git - " +
                        `Unable to parse data from ${filename}.json:\n${parseError}`
                );
                continue;
            }
        }

        const users = Array.from(userset);

        try {
            const usersObj = users.map((user, index) => {
                return {
                    name: user,
                    user_id: index,
                };
            });

            await cache.users.destroy({ where: {} });
            await cache.users.bulkCreate(usersObj);
        } catch (error) {
            return `Couldn't add users, something went wrong with sequelize: ${error}`;
        }
        return 200;
    },
};
