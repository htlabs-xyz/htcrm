FROM oven/bun:1.3.12 AS bun

FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

FROM base AS prune
COPY . .
RUN bun x turbo@2.10.8 prune agent --docker

FROM base AS manifests
COPY --from=prune /app/out/json/ ./

FROM manifests AS dependencies
RUN bun install --frozen-lockfile --ignore-scripts

FROM manifests AS production-dependencies
RUN bun install --frozen-lockfile --production --ignore-scripts

FROM dependencies AS source
COPY --from=prune /app/out/full/ ./
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build bun run --filter=@crm/db db:generate

FROM source AS build
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    CRM_TELEMETRY_DISABLED=1 bun run --filter=agent build

FROM production-dependencies AS agent
ENV NODE_ENV=production
ENV HOST=0.0.0.0 PORT=2000
COPY --from=source --chown=node:node /app/packages/ ./packages/
COPY --from=source --chown=node:node /app/apps/agent/agent/ ./apps/agent/agent/
COPY --from=source --chown=node:node /app/apps/agent/tsconfig.json ./apps/agent/
COPY --from=source --chown=node:node /app/packages/typescript-config/ ./apps/agent/node_modules/@crm/typescript-config/
COPY --from=build --chown=node:node /app/apps/agent/.output/ ./apps/agent/.output/
COPY --from=build --chown=node:node /app/apps/agent/.eve/ ./apps/agent/.eve/
RUN mkdir -p /app/apps/agent/node_modules/.cache \
    && chown node:node /app/apps/agent/node_modules/.cache
USER node
RUN mkdir -p /app/apps/agent/.eve/.workflow-data /app/apps/agent/.eve/sandbox-cache
WORKDIR /app/apps/agent
EXPOSE 2000
CMD ["node", ".output/server/index.mjs"]
