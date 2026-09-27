#!/bin/sh
set -eu

: "${CRON_SECRET:?CRON_SECRET is required}"

if curl --fail --silent --show-error --output /dev/null \
  --connect-timeout 10 --max-time 240 \
  --request POST --header "Authorization: Bearer ${CRON_SECRET}" \
  "http://api:3001$1"; then
  printf 'Cron completed: %s\n' "$1"
else
  printf 'Cron failed: %s\n' "$1" >&2
  exit 1
fi
