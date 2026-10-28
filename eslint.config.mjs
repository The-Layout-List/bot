import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import Globals from "globals";

export default tseslint.config(
    {
        ignores: [
            "node_modules",
            "dist",
            ".commandkit",
            "src/generated",
            "commandkit-env.d.ts",
            "data",
            "logs"
        ]
    },
    {
        languageOptions: {
            globals: {
                ...Globals.node
            }
        }
    },
    pluginJs.configs.recommended,
    tseslint.configs.recommended,
    {
        rules: {
            // Flags a few pre-existing "find or create" patterns
            "no-useless-assignment": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_", caughtErrors: "none" }
            ]
        }
    }
);
