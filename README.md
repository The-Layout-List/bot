# Layout List Manager

## This is a fork of the [All Rated Extreme Demon List](https://aredl.net)'s Manager V2 bot.

Credit to the original developers of that bot for doing all the hard work :fire:

## Original Readme:

This repository hosts the code for the discord bot made to help record submissions for the [All Rated Extreme Demons List](https://aredl.net). It is used to allow users to submit their records through discord, and to automatically add those records to a github repository that uses the [TSL List Template](https://github.com/TheShittyList/GDListTemplate)

## Setup

This bot does not provide any hosting, meaning that you will need to find a way to host it yourself. It is written in TypeScript using [discord.js](https://discord.js.org/) with the [CommandKit](https://commandkit.dev) framework, and stores its data in [PostgreSQL](https://www.postgresql.org/) through [Prisma](https://www.prisma.io/). You will need [NodeJS](https://nodejs.org/en) v24 or higher and a PostgreSQL database. After node has been installed, run `npm install` in the bot's root directory to install the dependencies (this also generates the Prisma client).
You will then need to create a config file (an example file is provided in `example_config.json`) and name it `config.json` in the root directory. It should contain the following:

> -   `enableSeparateStaffServer`: Enable this if there is a staff discord server for handling records that is not the public discord server. Will be used to fetch the following channels: `pendingRecordsID`,`priorityRecordsID`,`acceptedRecordsID`,`deniedRecordsID`,`archiveRecordsID`
> -   `enablePriorityRole`: Whether or not to enable the priority system. Records from users with a given role will be sent to a separate records channel and should be given priority to.
> -   `enableWelcomeMessage`: Whether or not to send a message when a user joins the server.

> -   `clientId`: The discord user ID of the bot.
> -   `guildId`: The discord server ID of your public server
> -   `staffGuildId`: If separate staff server is enabled, the discord server ID of your staff server

> -   `githubOwner`: The name of the github account that owns the list repository
> -   `githubRepo`: The name of the list repository
> -   `githubDataPath`: The path to the data folder from the repository root. If you haven't changed the base TSL Template, it is just `data`
> -   `githubBranch`: The branch to use, in most cases, just `main`

> -   `priorityRoleID`: If the priority system is enabled, the discord ID of the role that gives priority to records
> -   `submissionLockRoleID`: The discord ID of the role that prevents a user from submitting records (= list banned)

> -   `pendingRecordsID`: The channel ID in which records info and video will be sent for review. Anyone with access to this channel can accept or deny records.
> -   `priorityRecordsID`: Same as `pendingRecordsID`, but for priority records
> -   `acceptedRecordsID`: The channel ID in which, after being accepted, the record info and the moderator who accepted it, will be sent to.
> -   `deniedRecordsID`: The channel ID in which, after being denied, the record info and the moderator who denied it, along with the deny reason, will be sent to.
> -   `archiveRecordsID`: The channel ID where both accepted and denied records will be sent to, with more extensive information.

> -   `guildMemberAddID`: If welcome messages are enabled, the channel ID in which to send them.

After you have created this config file, rename the `.env.example` file to `.env` and edit the values inside:

> -   `TOKEN`: The discord bot private token. If you do not know what a token is and how to set up a discord bot, refer to [this discord.js guide](https://discordjs.guide/preparations/setting-up-a-bot-application.html)
> -   `GITHUB_TOKEN`: The github token that will allow the bot to fetch data from and make changes to the github repository of the list. To create one, refer to [this github page](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
> -   `DATABASE_URL`: The connection string of the PostgreSQL database, e.g. `postgresql://user:password@localhost:5432/layoutlist`

Then create the database tables by running `npm run db:deploy`.

> If you are upgrading from the older SQLite version of the bot, import your existing data **before starting the bot for the first time** with `npm run db:import-sqlite -- ./data/database.sqlite`. The list cache (`data/cache.sqlite`) doesn't need to be imported, it is rebuilt from the list repository on startup.

### Be sure to properly set the command permissions in your discord server settings ("Integrations" tab), so that only staff/admins can use their respective commands. The list of all commands is detailed later on.

To run the bot:

> -   `npm run dev`: development mode, with hot reloading
> -   `npm run build` then `npm start`: production mode

Slash commands are registered automatically when the bot starts, in the public server and (if enabled) the staff server.

### Development

> -   Commands live in `src/app/commands/(category)/`, and events in `src/app/events/<event name>/` (see the [CommandKit docs](https://commandkit.dev/docs)). Prefixing a file with `_` disables it.
> -   Persistent buttons and modals live in `src/components/` and are registered in `src/components/index.ts`.
> -   Scheduled tasks live in `src/scheduled/` and are registered in `src/scheduled/index.ts`.
> -   The database schema is in `prisma/schema.prisma`. After changing it, run `npm run db:migrate -- --name <change>` to create a migration.
> -   `npm run typecheck` and `npm run lint` check the code.

