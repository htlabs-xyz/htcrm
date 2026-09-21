FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY apps/api/vercel.json ./apps/api/vercel.json
COPY docker/write-crontab.mjs ./docker/write-crontab.mjs
RUN node docker/write-crontab.mjs > /crontab

FROM alpine:3.23 AS scheduler
RUN apk add --no-cache curl
COPY --from=build /crontab /etc/crontabs/root
COPY --chmod=755 docker/run-cron.sh /usr/local/bin/run-cron
ENV TZ=UTC
CMD ["crond", "-f", "-d", "6"]
