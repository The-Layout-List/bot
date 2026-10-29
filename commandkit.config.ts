import { tasks } from "@commandkit/tasks";
import { defineConfig } from "commandkit/config";
import { RuntimePlugin, type CommandKitPluginRuntime } from "commandkit/plugin";
import type { Interaction } from "discord.js";

/**
 * CommandKit 1.2 looks up subcommand interactions by their full route
 * (e.g. `flag.set`), which only exists for hierarchical command folders. Our
 * commands are single files that declare their subcommands in the builder, so
 * those interactions were silently dropped. This resolves them by the command
 * name instead and runs them through CommandKit's normal pipeline
 * (middlewares, guild checks, error handling).
 */
class FlatSubcommandRouting extends RuntimePlugin {
    readonly name = "flat-subcommand-routing";

    async onBeforeInteraction(
        ctx: CommandKitPluginRuntime,
        interaction: Interaction
    ) {
        if (!interaction.isChatInputCommand() && !interaction.isAutocomplete())
            return;
        if (!interaction.options.getSubcommand(false)) return;

        const handler = ctx.commandkit.commandHandler;
        const prepared = await handler.prepareCommandRun(
            interaction,
            interaction.commandName
        );
        if (!prepared) return;

        await handler.commandRunner.runCommand(prepared, interaction);
        // Skip CommandKit's default routing, which can't find this command
        ctx.capture();
    }
}

export default defineConfig({
    plugins: [
        new FlatSubcommandRouting({}),
        // Scheduled jobs live in src/app/tasks, persisted in ./commandkit-tasks.db
        tasks()
    ],
    // Commands are registered per-guild from each command's metadata; there
    // are no prefix (message) commands.
    disablePrefixCommands: true
});
