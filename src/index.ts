import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { CommandKit } from 'commandkit';
import path from 'node:path';
import { prisma } from './lib/prisma';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
  ],
});

async function bootstrap() {
  await prisma.$connect();

  new CommandKit({
    client,
    commandsPath: path.join(__dirname, 'commands'),
    eventsPath: path.join(__dirname, 'events'),
    devGuildIds: [],
    devUserIds: [],
    devRoleIds: [],
    bulkRegister: true,
  });

  await client.login(process.env.TOKEN ?? '');
}

bootstrap().catch((error) => {
  console.error('Failed to start bot:', error);
  process.exit(1);
});
