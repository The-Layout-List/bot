import path from 'node:path';
import { defineConfig } from 'prisma/config';

defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    provider: 'sqlite',
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  },
});
