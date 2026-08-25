# Setup and local development

Operational detail moved out of the rule docs. `api.md`, `agent.md` and
`environment.md` are what agents read before changing code; this is what a person
reads once.

## First run

```sh
# Copy the committed environment template to the repository root, then fill both secrets and ALLOWED_SIGN_IN.
bun run db:migrate && bun run db:seed
bun run dev                 # app :3000, api :3001, agent :2000
```

`CLOUDFLARE_DATABASE_NAME` names the local D1 database. Wrangler stores it under
`packages/db/.wrangler`, and `@crm/db` discovers that SQLite file automatically.
No Cloudflare account or token is needed for local development.

Prisma and D1 commands from the repo root:

| Command | Target |
| --- | --- |
| `db:generate` | Generate the Prisma client |
| `db:migrate` / `db:push` | Apply pending migrations to local D1 |
| `db:migration:create -- <name>` | Create a Wrangler D1 migration |
| `db:reset` | Back up and rebuild local D1 |
| `db:seed` | Migrate and seed local D1 |
| `db:studio` | Inspect local D1 |
| `db:deploy` | Explicitly apply migrations to remote D1 |
| `db:seed:remote` | Explicitly migrate and seed remote D1 |

`dev` depends on `^dev:prepare`, so every start applies pending migrations and
regenerates the Prisma client before a server boots. The explicit first migration
is needed only for the seed that follows it. `db:reset` copies the existing local
Wrangler state to `packages/db/.d1-backups` before rebuilding it.

## Transaction coordination

D1 does not provide row locks, and Prisma's D1 adapter does not make an
interactive transaction atomic. The API and agent therefore serialize their
transaction-sensitive writes through `packages/db/coordinator.ts`, a Worker
backed by a SQLite Durable Object namespace.

Local development uses the coordinator at `http://127.0.0.1:8788` when
`D1_COORDINATOR_URL` and `D1_COORDINATOR_SECRET` are set. The root `dev` task starts
that Worker with the other applications. Tests always use a single-process mutex;
the coordinator Worker has its own isolated runtime suite.

Production requires the coordinator URL and the same secret on every Node/Vercel
consumer. Deploying it is explicit:

```sh
bun run --filter=@crm/db coordinator:deploy
bun run --filter=@crm/db coordinator:secret
```

The Durable Object lease prevents concurrent writers across application instances.
It does not add rollback to a failed multi-statement Prisma write, so critical paths
also use idempotency keys and conditional updates.

## Google Cloud

- **Enable the Gmail API and the Google Calendar API** on the project.
- **Set the consent screen to User type: Internal** if you are on Workspace.
  `gmail.readonly` is a *restricted* scope, so an External app needs OAuth
  verification plus an annual CASA assessment. Going External later means the full
  review — a decision, not a checkbox.

## The agent bridge

```sh
AGENT_URL="http://127.0.0.1:2000"   # 127.0.0.1, not localhost: eve dev is IPv4-only
AGENT_BRIDGE_SECRET="$(openssl rand -base64 32)"
```

| Agent tab error | Cause |
| --- | --- |
| `503` | `AGENT_BRIDGE_SECRET` unset in the app's process |
| `401` | The two processes hold different secrets, **or** `passThroughEnv` in `apps/app/turbo.json` / `apps/agent/turbo.json` is missing the pair (Turbo is strict-env) |
| `502` | Agent not running, or `AGENT_URL` wrong |

`localDev()` accepts any loopback request, so `curl 127.0.0.1` proves nothing about
the bridge — send `-H 'Host: agent.example.com'`. `GET /eve/v1/info` is the whole
inventory, including a `diagnostics` count that finds files eve silently ignored.

## Running the agent

The agent package's default `dev` command is interactive `eve dev`. The root
Turbo task marks it interactive, so select the agent pane and press Enter before
using the eve TUI. Run `turbo run dev:headless --filter=agent` when a terminal
cannot render the TUI; that uses `eve dev --no-ui`, and the Turbo pane is the
record because only interactive development writes `.eve/logs/` for `eve logs`.
Reach for the Turbo task rather than `bun run --filter=agent dev:headless`: the
package script alone skips `dev:prepare`, so the agent would start against
unmigrated tables.

`hooks/activity.ts` is the replacement narration, **to stderr** (the TUI hides
stdout), printing shape everywhere and argument contents outside production only. It
is **not the audit trail** — `hooks/audit.ts` writes `AgentEvent` regardless.

- A second `bun run dev` fails the whole turbo run.
- An orphaned agent holds the port: `lsof -nP -iTCP:2000 -sTCP:LISTEN`.

### Nothing is researching, and the queue only grows

**`eve dev` never fires schedules on their cron cadence**, and everything visible
still works — the row is written, the sheet says *Queued*, and `dispatch.ts` is never
called. The poke covers this **only when `AGENT_BRIDGE_SECRET` is set**; unset,
`poke()` returns silently and the queue looks exactly like a slow agent.

Tasks the API did not write (`schedule_recheck`) and anything queued while the agent
was down still need a manual run:

```sh
bun run --filter=agent dispatch    # exact production path, both lanes, real credits
```

Its printed `sessionIds` are research rows only, so a run that resolved forty logos
prints an empty list and was not idle. `eve start` and Vercel do run the schedule.

## Keep production D1 credentials out of local overrides

The local override file loads last. A Vercel environment pull writes production
values there by default. A complete Cloudflare credential set makes application
processes use remote D1. Pull into an inert file instead.

Local database commands always pass Wrangler's `--local` flag. Only `db:deploy` and
`db:seed:remote` can modify remote D1.

## Migrations run on the production deploy, and nowhere else

`apps/api/scripts/build-func.mjs` runs `db:deploy` only when Vercel reports a
production deployment, the database name, and all three D1 credentials are present.
Preview builds do not mutate remote D1. Wrangler records applied files in
`d1_migrations`; migration
SQL remains the deployment authority because Prisma Migrate does not target D1.

## Portainer

`docker-compose.portainer.yml` runs the web app, API, agent, remote D1
migrations, and the API schedules. The D1 coordinator remains a Cloudflare Worker.

Create a Portainer Git stack from this repository. Select
`docker-compose.portainer.yml` as the Compose path. Add every required stack variable
reported by Portainer before deployment. Keep all secret values in Portainer. Do not
write them into the YAML file.

Publish the app and API ports through your reverse proxy. The agent stays on the
private Compose network, and the app proxies agent requests.

Set `APP_PUBLIC_URL` and `API_PUBLIC_URL` to the external HTTPS origins. Configure the
same origins in the OAuth providers. The API uses its in-memory cache because the
stack runs one API instance.

The one-shot `migration` service applies remote D1 migrations before the API starts.
The `scheduler` service replaces the schedules from `apps/api/vercel.json`. The built
agent server also starts its dispatch schedule.

Portainer on Docker Standalone builds the three application images from the Git
repository. A Swarm stack needs prebuilt images because Swarm does not build images
from `build` entries.

## Secrets hygiene

Git ignores root environment files except the committed template. The template ships
empty secret placeholders, asserted by `packages/env/test/root.spec.ts`. Generate
your own secrets and never reuse tutorial or production values.

## Tests

```sh
bun run --filter=api test
bun run --filter=agent test
```

### The test database rebuilds itself when it drifts

`bun run db:test` backs up the current local Wrangler state, rebuilds local D1, and
applies every migration. It never reads or mutates a remote database.
