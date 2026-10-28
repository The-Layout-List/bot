import { tasks } from "@commandkit/tasks";
import { defineConfig } from "commandkit/config";

export default defineConfig({
    // Scheduled jobs live in src/app/tasks, persisted in ./commandkit-tasks.db
    plugins: [tasks()],
    // Commands are registered per-guild from each command's metadata; there
    // are no prefix (message) commands.
    disablePrefixCommands: true
});
