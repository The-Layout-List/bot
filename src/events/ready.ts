import { Events } from 'discord.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: { user: { username: string } }) {
    console.log(`Logged in as ${client.user.username}`);
  },
};
