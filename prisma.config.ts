import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations"
    },
    datasource: {
        // Not required for `prisma generate`, only for commands that talk to the database
        url: process.env.DATABASE_URL ?? ""
    }
});
