FROM oven/bun:1.3.12 AS bun

FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

FROM base AS prune
COPY . .
RUN bun x turbo@2.10.8 prune app --docker

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
ENV NEXT_TELEMETRY_DISABLED=1
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    BETTER_AUTH_SECRET="$(openssl rand -hex 32)" ALLOWED_SIGN_IN=build.invalid \
    API_URL=http://api:3001 bun run --filter=app build

FROM production-dependencies AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=source --chown=node:node /app/packages/ ./packages/
COPY --from=build --chown=node:node /app/apps/app/.next/ ./apps/app/.next/
COPY --from=source --chown=node:node /app/apps/app/public/ ./apps/app/public/
COPY --from=source --chown=node:node /app/apps/app/next.config.ts ./apps/app/
USER node
WORKDIR /app/apps/app
EXPOSE 3000
CMD ["bun", "run", "start", "--hostname", "0.0.0.0"]
