# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base
WORKDIR /app
# git: the bot keeps a local clone of the list repository in data/repo
# fonts: the canvas libraries ship without fonts, charts need at least one
# cairo/pango/...: shared libraries for node-canvas (used by chartjs-node-canvas)
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates fontconfig fonts-dejavu-core \
        libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# Build: full dependencies + compiled bot. Also used to run Prisma migrations
# and the SQLite import script, which need the dev dependencies.
# ---------------------------------------------------------------------------
FROM base AS build
# node-canvas has no prebuilt binary for some platforms (e.g. linux/arm64) and
# falls back to compiling from source
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential python3 pkg-config \
        libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# postinstall runs `prisma generate`
RUN npm ci
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# Runtime: production dependencies + build output only
# ---------------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
# commandkit.config.ts is loaded from the working directory at startup (plugins)
COPY --from=build /app/package.json /app/package-lock.json /app/log4js.json /app/commandkit.config.ts ./
COPY --from=build /app/node_modules ./node_modules
RUN npm prune --omit=dev --ignore-scripts
COPY --from=build /app/dist ./dist
RUN mkdir -p data logs && chown -R node:node /app
USER node
CMD ["npm", "start"]
