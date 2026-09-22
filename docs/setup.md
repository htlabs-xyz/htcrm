# Setup and local development

Operational detail moved out of the rule docs. `api.md`, `agent.md` and
`environment.md` are what agents read before changing code; this is what a person
reads once.

## Docker deployment

Run these commands from the Git repository root, beside `docker-compose.prod.yml` and `package.json`.
Install Docker Engine and Docker Compose v2.20 or newer. Bun and Node are included in the images.

Copy the root environment template, as described under [First run](#first-run).
Set these values in that root environment file:

| Variable | Value |
| --- | --- |
| `POSTGRES_PASSWORD` | A unique URL-safe password. Generate it with `openssl rand -hex 32`. |
| `BETTER_AUTH_SECRET` | A separate random secret of at least 32 characters. |
| `AGENT_BRIDGE_SECRET` | A separate random secret. Compose gives the same value to all application services. |
| `CRON_SECRET` | A separate random secret of at least 16 characters. |
| `ALLOWED_SIGN_IN` | Your email address or company email domain. |
| `APP_URL` | Your browser-facing origin. Default: `http://localhost:3000`. Use HTTPS on a remote host. |
| Google or Microsoft client pair | Configure one provider for the first sign-in. See the root README. |

Generate each secret separately with `openssl rand -hex 32`. Keep these values stable across upgrades.
Do not copy the development Postgres password into production.

Deploy with one command:

```sh
docker compose -f docker-compose.prod.yml up --build -d --wait
```

The command builds five separate images and starts the complete stack:

- PostgreSQL stores CRM records in the `postgres-data` volume.
- `migrate` applies committed Prisma migrations, then exits successfully. It never seeds example records.
- `api` serves NestJS on the private network. Its health check also checks PostgreSQL.
- `agent` serves the built eve application and runs its schedules.
- `web` serves Next.js on port 3000 after API and agent health checks pass.
- `scheduler` calls the API jobs defined in `apps/api/vercel.json`, using UTC and `CRON_SECRET`.

The agent starts Node directly on `.output/server/index.mjs`, with `HOST=0.0.0.0` and `PORT=2000`.
This runs the built channels, tools, and schedules without the Eve CLI's startup sandbox prewarm.
In Eve 0.29.4, that prewarm can rebundle authored source before opening the HTTP server and exhaust a small host's memory.
Both production Compose files override the command, so already-published images also use the built server.

The development `docker-compose.yml` remains database-only. Its database volume is separate from the production stack.
Compose constructs the container database URL from `POSTGRES_PASSWORD`. The development `DATABASE_URL` does not override it.

### GitHub Container Registry

The [Docker images workflow](../.github/workflows/docker-images.yml) builds and pushes five images to GHCR.
It runs on pushes to `release`, pushes of tags matching `v*`, and manual runs from the Actions tab.
Each image builds on its own runner for `linux/amd64`, with a separate build cache.

| Service | Default image |
| --- | --- |
| Web | `ghcr.io/htlabs-xyz/htcrm-web` |
| API | `ghcr.io/htlabs-xyz/htcrm-api` |
| Agent | `ghcr.io/htlabs-xyz/htcrm-agent` |
| Migrations | `ghcr.io/htlabs-xyz/htcrm-migrate` |
| Scheduler | `ghcr.io/htlabs-xyz/htcrm-scheduler` |

The workflow derives names from its repository, so a fork publishes under its own owner and repository name.
Every image receives a `sha-<full-commit-SHA>` tag.
Branch builds also receive `branch-<branch-name>`; Git tags matching `v*` retain their names.
For example, a `v1.16.0` Git tag produces a `v1.16.0` image tag.
Only builds from the `release` branch update `latest`. Manual builds from other branches keep their own `branch-` tags.

The workflow uses its automatic `GITHUB_TOKEN` with `packages: write`; no registry password secret is required.
Builds use no deployment environment file or runtime credentials.
GitHub initially makes new container packages private. Keep that visibility or change it in each package's settings.
For private packages, log in on the deployment host with a classic PAT that has `read:packages` and package access:

```sh
docker login ghcr.io -u YOUR_GITHUB_USERNAME
```

Paste the token at the password prompt. Do not put it in a shell command or repository file.
An existing package must grant this repository Actions access before its workflow can push updates.
See [GitHub's registry access documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

After all five jobs pass, deploy the published images with the root environment configuration from above:

```sh
docker compose -f docker-compose.prod.yml -f docker-compose.ghcr.yml up --no-build --pull always -d --wait
```

The override selects GHCR images. `--no-build` prevents local builds; `--pull always` retrieves the selected tags.
Set `IMAGE_TAG=sha-<full-commit-SHA>` in the root environment file to keep every service on one successful build.
The default is `latest`. Wait for the entire workflow to succeed before using its images; jobs publish independently.
Set `IMAGE_PREFIX` when using images published from another fork.
Use a checkout from the same release as the images, so Compose configuration and migrations remain compatible.

The original build command still builds from local source. GHCR deployment uses the same services, ports, and persistent volumes.
This workflow publishes images only. It does not deploy a server or run migrations against a deployment database.
Publishing starts after the workflow and Dockerfiles are committed and pushed to GitHub.
Once the workflow is on `release`, a manual run uses:

```sh
gh workflow run docker-images.yml --repo htlabs-xyz/htcrm --ref release
```

If another workflow updates refs using `GITHUB_TOKEN`, its push does not trigger this workflow; run it manually from Actions.
See [GitHub's workflow trigger rules](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

### Portainer

Use a Docker Standalone environment on a Linux `amd64` host.
The [Portainer stack](../docker-compose.portainer.yml) pulls images without a source checkout or local builds.
It preserves the production stack's health checks, migration ordering, private ports, schedules, and three persistent volumes.

1. Open **Stacks → Add stack**. Use the stack name `crm`. For an existing deployment, keep its exact stack name.
2. Paste `docker-compose.portainer.yml` into **Web editor**, or select it through **Upload**.
3. Under **Environment variables**, enter the values below.
4. Replace the example domain and email. Generate each of the four blank secrets separately with `openssl rand -hex 32`.
5. Set one complete Google or Microsoft client pair for sign-in. Set `AI_GATEWAY_API_KEY` for model calls.
6. Select **Deploy the stack**.

See [Portainer's stack creation instructions](https://docs.portainer.io/user/docker/stacks/add) for its environment import controls.
This example pins all five application images to the same published commit:

```dotenv
IMAGE_PREFIX=ghcr.io/htlabs-xyz/htcrm
IMAGE_TAG=sha-b62cd00c58e9a2517e5ecb0a439c0befe4ce1a54
APP_URL=https://crm.example.com
HTTP_BIND=0.0.0.0
HTTP_PORT=33000
ALLOWED_SIGN_IN=you@example.com
POSTGRES_PASSWORD=
BETTER_AUTH_SECRET=
AGENT_BRIDGE_SECRET=
CRON_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common
AI_GATEWAY_API_KEY=
```

The `htlabs-xyz/htcrm-*` packages are public. They require no registry credentials.
Variables omitted from this smaller template retain their defaults. The root environment template documents all variables.
The stack reads variables from Portainer's environment fields; it requires no `env_file` or host bind mounts.

Point your HTTPS proxy to the Docker host's published port. The example above uses `33000`;
Compose defaults to `3000` if `HTTP_PORT` is omitted. Nginx Proxy Manager using host networking
already listens on `3000`, so use a different free port for CRM in that setup.
Use your browser-facing HTTPS origin for `APP_URL`. Omit `API_URL` to use that same origin.
Register `<APP_URL>/api/auth/callback/google` or `<APP_URL>/api/auth/callback/microsoft` with the selected provider.
The stack publishes only the web port. The agent listens internally on `2000`, and the API listens internally on `3001`.

After deployment, `migrate` exits with code `0`; PostgreSQL, API, agent, and web report healthy; scheduler remains running.
Use Portainer's container logs to investigate a failed migration or health check.
Keep the stack name and secrets unchanged during upgrades to retain the same database and agent volumes.
Back up PostgreSQL before upgrades. Change `IMAGE_TAG` to another fully published commit tag, then update the stack.

#### Recovering failed startup

`x-app-environment` is a shared YAML block merged into web, API, and agent environments. It is not a container.
Portainer must supply every required `${VARIABLE:?message}` value before Compose can create the stack.
For a short `BETTER_AUTH_SECRET`, replace the value in the stack environment with a separately generated
random secret of at least 32 characters, then update the stack to recreate the application containers.

For Prisma `P1000`, compare the application's database URL with the PostgreSQL container's configured password
without printing either value. PostgreSQL only applies `POSTGRES_PASSWORD` when initializing an empty data directory;
changing the environment does not change the role password in an existing volume.
Restore the original password in the stack environment, or deliberately synchronize the existing role password
with the intended stack value through a local database administration connection. Preserve `postgres-data`.
See the [PostgreSQL image initialization rules](https://github.com/docker-library/docs/blob/master/postgres/README.md#environment-variables).

Verify password authentication over the Docker network with host `postgres`. A Unix socket or `127.0.0.1`
can use local trust authentication and does not prove that the application password works.
Check that `migrate` exits `0` and `/health` succeeds before considering the database recovered.

If stack creation fails, Portainer can leave Compose containers and volumes without a managed stack record.
Inspect containers with the exact `com.docker.compose.project` label before creating anything again.
Recover using the same stack name, image tags, environment, and named volumes. Fix the reported startup cause
before retrying; a new stack name would select different volumes.

### URLs and optional services

The web image sends server requests to `http://api:3001`. Browser requests use the web origin.
Compose defaults `API_URL` to `APP_URL`, so OAuth callbacks return through the web proxy.
Register `<APP_URL>/api/auth/callback/google` or `<APP_URL>/api/auth/callback/microsoft` with your provider.
Public URL changes require container recreation, with the deploy command above. The image contains no public domain.

Terminate HTTPS at your existing reverse proxy and forward requests to the published web port.
Preserve streaming responses. Set `HTTP_PORT` to change the published port.
Set `HTTP_BIND=127.0.0.1` when a proxy on the same host owns public access.
The stack publishes no database, API, or agent port. Production cookies require HTTPS for remote sign-in.

`AI_GATEWAY_API_KEY` enables model calls outside Vercel. The CRM starts without this key; model calls require it.
Configure the Context key during onboarding. Other integration settings remain optional.
An existing Redis service is supported through `REDIS_URL`; the default is the API's in-memory cache.

The agent uses eve's existing `just-bash` fallback inside Docker. It runs an interpreted shell without a Docker daemon.
The stack mounts no host Docker socket. Workflow state and sandbox files use separate persistent volumes.

### Images, checks, and logs

Each application owns its Dockerfile. The API Dockerfile also provides the migration image.
The scheduler has a separate Dockerfile because it only needs cron and curl at runtime.

| Image | Dockerfile | Target |
| --- | --- | --- |
| Web | `apps/app/Dockerfile` | `web` (default) |
| API | `apps/api/Dockerfile` | `api` (default) |
| Agent | `apps/agent/Dockerfile` | `agent` (default) |
| Migrations | `apps/api/Dockerfile` | `migrate` |
| Scheduler | `docker/scheduler.Dockerfile` | `scheduler` (default) |

Build any image independently from the repository root:

```sh
docker build -f apps/app/Dockerfile -t htcrm-web:local .
docker build -f apps/api/Dockerfile -t htcrm-api:local .
docker build -f apps/agent/Dockerfile -t htcrm-agent:local .
docker build -f apps/api/Dockerfile --target migrate -t htcrm-migrate:local .
docker build -f docker/scheduler.Dockerfile -t htcrm-scheduler:local .
```

Keep the build context as the repository root (`.`), because the applications use shared workspace packages.
Each application build uses `turbo prune` to select its declared workspace dependencies and a matching subset of the lockfile.
API and agent images exclude the web workspace and UI dependencies. The web build also includes API dependencies because its manifest declares the API workspace.
Dependency installation is cached separately from application source. Runtime application images install production dependencies; the migration image retains the Prisma CLI.
Application services run as the image's non-root `node` user.
Builds use the committed Bun lockfile and generate Prisma clients without connecting to the deployment database.
Environment files, database dumps, and local build outputs are excluded from the build context.

```sh
docker compose -f docker-compose.prod.yml ps -a
docker compose -f docker-compose.prod.yml logs --tail=100 web api agent migrate scheduler
docker compose -f docker-compose.prod.yml exec api bun -e 'console.log(await (await fetch("http://127.0.0.1:3001/health")).json())'
docker compose -f docker-compose.prod.yml exec scheduler run-cron /internal/sync/mailboxes
```

The last command runs real mailbox synchronization for configured accounts.
Container logs rotate at 10 MB with three files per service.

### Upgrades, backups, and shutdown

Back up PostgreSQL before upgrading. Store the backup securely; it contains CRM data.

```sh
umask 077
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U postgres -d crm -Fc > crm-backup.dump
```

Update the checkout to your chosen release, then run the deploy command again.
Pending migrations run before application startup. Existing volumes remain attached.
Rolling back application code does not reverse database migrations. Restore a compatible database backup when required.
Back up the `agent-workflows` and `agent-sandboxes` volumes while the agent is stopped to preserve its filesystem state.

```sh
docker compose -f docker-compose.prod.yml down
```

This stops the stack and preserves its volumes. Adding `--volumes` deletes database and agent state.

## First run

```sh
cp .env.example .env        # fill DATABASE_URL, BETTER_AUTH_SECRET, ALLOWED_SIGN_IN
docker compose up -d        # Postgres, matching .env.example
bun run db:migrate && bun run db:seed
bun run dev                 # app :3000, api :3001, agent :2000
```

Prisma from the repo root: `db:generate`, `db:migrate`, `db:push`, `db:reset`,
`db:seed`, `db:studio`, `db:deploy`.

`dev` depends on `^dev:prepare`, so every start applies pending migrations and
regenerates the Prisma client before a single server boots. That is why the first
run needs `db:migrate` only for the seed that follows it. When the database and
`schema.prisma` have diverged past what `migrate deploy` can reconcile,
`dev:prepare` stops the whole run rather than starting servers against a schema
they do not match — reconcile with `db:migrate`, or `db:reset` when the divergence
is an edited migration that has already been applied.

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

## `vercel env pull` writes `.env.local`, which wins

`.env.local` is the override the loader reads *last*, and `vercel env pull` writes
**production** credentials there by default. Pull once and every process silently
points at production — not as an error, but as `bun run dev` working perfectly against
the live database. On 2026-08-01 eleven migrations landed on Neon from a laptop.

1. **Pull somewhere inert**: `vercel env pull .env.vercel`.
2. **`packages/db/scripts/require-local-db.ts` guards `db:migrate`, `db:push`,
   `db:reset`, `db:seed`** and takes `ALLOW_REMOTE_DB=1`. `db:deploy` is unguarded on
   purpose. It reads the root files directly rather than `process.env`, because Bun
   auto-loads the working directory's `.env` while Prisma's CLI only sees
   `@crm/env/load`.

## Migrations run on the production deploy, and nowhere else

`apps/api/scripts/build-func.mjs` runs `prisma migrate deploy` during the crm-api
build, gated on `VERCEL_ENV === "production"`. The schema therefore moves when the
release pull request merges and `release` deploys — with the code that needs it,
and once rather than once per branch.

Preview deploys share the production database: `DATABASE_URL` is a single value
across production, preview and development. Until that changes, **a preview of a
branch that adds a migration runs against a database without those tables** — it
builds, and the pages that touch them fail. Test schema changes locally, where
`bun run dev` migrates for you. Before the gate existed the reverse was true and
worse: every preview applied its own migrations to the production database, so on
2026-08-07 the live schema ran six migrations ahead of the live code all day.

### `migrate deploy` is not proof the schema is right

The build follows the deploy with `prisma migrate diff --exit-code` against
`schema.prisma` and shouts in the build log when they disagree. **`No pending
migrations to apply` only means `_prisma_migrations` has a row for every file** —
it says nothing about what the tables actually look like.

They came apart once. A `prisma db push` shaped production from a laptop, the
migration rows were recorded as applied without their SQL ever running, and
`agentConversationAttachment` went live without its `position` column. Every deploy
reported nothing pending, for days, while `conversations.builderById` returned 500.
The tell is an object in the database that no migration defines — there was an
`agentConversationAttachment_submissionId_createdAt_idx` that appears in no
migration file, only in a `db push` of an older schema.

Reconciling is one command, and it is worth reading before running:

```sh
DATABASE_URL="…" bunx prisma migrate diff \
  --from-config-datasource --to-schema prisma/schema.prisma --script
```

## Secrets hygiene

`.gitignore` ignores `.env` and `.env.*` with one negation for `.env.example`, so
`.env.bak` is ignored too. `.env.example` ships no secret — placeholders are empty
strings, asserted by `packages/env/test/root.spec.ts`. **Generate your own secret**;
never reuse one from an example, a tutorial, or another environment.

## Tests

```sh
bun run --filter=api test
bun run --filter=agent test    # integration specs need DATABASE_URL + real Postgres
```

### The test database rebuilds itself when it drifts

`bun run db:test` creates `crm_test` and runs `migrate deploy` on it. The database
name must end in `_test`; the suite deletes rows it expects to put back, so it
refuses anything else.

**`migrate deploy` only applies migrations that are missing. It never removes a
table, a column or a constraint the database has and the schema does not.** A
`crm_test` built on a branch that was later abandoned therefore keeps that branch's
objects forever, and `db:test` used to report `already exists` and move on. The
extra objects are invisible until one of them rejects a write, and then the failure
names a constraint that appears in no migration and in no schema — a stray
`trackedEvent_visitorId_fkey` once failed seven tracking specs this way, on every
branch, for as long as the database survived.

So `db:test` now checks the database it found and rebuilds it when either is true:

- **It holds a migration this branch does not have.** The database came from
  another branch. The name of the first one is printed.
- **It no longer matches `schema.prisma`**, by `prisma migrate diff`. Something
  was pushed or altered by hand.

A rebuild drops the database and re-runs every migration, and it says which of the
two reasons fired. Force one with `bun run db:test --reset`. Nothing else in the
repo may drop a database, and this may only because the `_test` suffix is checked
first.
