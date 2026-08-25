# syntax=docker/dockerfile:1.7

ARG BUN_VERSION=1.3.12

FROM oven/bun:${BUN_VERSION}-debian AS bun

FROM node:24-bookworm-slim AS base

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY --from=bun /usr/local/bin/bunx /usr/local/bin/bunx

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates curl openssl \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV CI=true
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS manifests

COPY package.json bun.lock turbo.json ./
COPY apps/agent/package.json apps/agent/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/app/package.json apps/app/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/env/package.json packages/env/package.json
COPY packages/telemetry/package.json packages/telemetry/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/validation/package.json packages/validation/package.json

FROM manifests AS build-dependencies

RUN bun install --frozen-lockfile --ignore-scripts

FROM manifests AS api-production-dependencies

RUN bun install --frozen-lockfile --production --ignore-scripts --filter=api

FROM manifests AS migration-dependencies

RUN bun install --frozen-lockfile --ignore-scripts --filter=@crm/db

FROM build-dependencies AS source

COPY . .

ENV DATABASE_URL=postgresql://localhost:5432/ci

RUN bun run --filter=@crm/db db:generate

FROM migration-dependencies AS migration

COPY . .

ENV NODE_ENV=production

CMD ["bun", "run", "--filter=@crm/db", "db:deploy"]

FROM source AS api-builder

RUN bun run --filter=api build

FROM source AS agent-builder

RUN bun run --filter=agent build

FROM source AS app-builder

ARG INTERNAL_API_URL=http://api:3001
ARG PUBLIC_API_URL=/api

ENV API_URL=${INTERNAL_API_URL}
ENV NEXT_PUBLIC_API_URL=${PUBLIC_API_URL}
ENV BETTER_AUTH_SECRET=docker-build-only-placeholder-secret-000000000000
ENV ALLOWED_SIGN_IN=build.invalid

RUN bun run --filter=app build

FROM base AS runtime

ENV NODE_ENV=production

RUN groupadd --system --gid 1001 crm \
	&& useradd --system --uid 1001 --gid crm --home-dir /app crm

FROM runtime AS api

COPY --from=api-production-dependencies --chown=crm:crm /app /app
COPY --from=api-builder --chown=crm:crm /app/apps/api/dist /app/apps/api/dist
COPY --from=api-builder --chown=crm:crm /app/packages/auth/src /app/packages/auth/src
COPY --from=api-builder --chown=crm:crm /app/packages/db/src /app/packages/db/src
COPY --from=api-builder --chown=crm:crm /app/packages/env/src /app/packages/env/src
COPY --from=api-builder --chown=crm:crm /app/packages/telemetry/src /app/packages/telemetry/src
COPY --from=api-builder --chown=crm:crm /app/packages/validation/src /app/packages/validation/src

USER crm

EXPOSE 3001

CMD ["bun", "run", "--filter=api", "start:prod"]

FROM runtime AS agent

COPY --from=agent-builder --chown=crm:crm /app/apps/agent/.output /app/apps/agent/.output

USER crm

EXPOSE 2000

CMD ["node", "apps/agent/.output/server/index.mjs"]

FROM runtime AS app

COPY --from=app-builder --chown=crm:crm /app/apps/app/.next/standalone /app
COPY --from=app-builder --chown=crm:crm /app/apps/app/.next/static /app/apps/app/.next/static
COPY --from=app-builder --chown=crm:crm /app/apps/app/public /app/apps/app/public

USER crm

EXPOSE 3000

CMD ["node", "apps/app/server.js"]
