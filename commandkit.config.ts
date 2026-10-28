import { defineConfig } from "commandkit/config";

export default defineConfig({
    // Commands are registered per-guild from each command's metadata; there
    // are no prefix (message) commands.
    disablePrefixCommands: true
});
