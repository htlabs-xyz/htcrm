FROM oven/bun:1.3.12 AS bun

FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

FROM base AS prune
COPY . .
RUN bun x turbo@2.10.8 prune api --docker

FROM base AS manifests
COPY --from=prune /app/out/json/ ./

FROM manifests AS dependencies
RUN bun install --frozen-lockfile --ignore-scripts

FROM manifests AS production-dependencies
RUN bun install --frozen-lockfile --production --ignore-scripts

FROM dependencies AS source
COPY --from=prune /app/out/full/ ./
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build bun run --filter=@crm/db db:generate
RUN node apps/api/scripts/chmod-trpc-binary.mjs

FROM source AS build
RUN NODE_ENV=production bun run --filter=api build

FROM source AS migrate
ENV NODE_ENV=production
USER node
WORKDIR /app/packages/db
CMD ["bun", "run", "db:deploy"]

FROM production-dependencies AS api
ENV NODE_ENV=production
COPY --from=source --chown=node:node /app/packages/ ./packages/
COPY --from=build --chown=node:node /app/apps/api/dist/ ./apps/api/dist/
COPY --from=source --chown=node:node /app/apps/api/tsconfig.json ./apps/api/
USER node
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["bun", "run", "start:prod"]
