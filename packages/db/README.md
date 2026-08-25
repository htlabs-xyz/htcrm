# `@crm/db`

Cloudflare D1 access for the monorepo: the Prisma schema, Wrangler migrations,
and one shared `PrismaClient` instance.

## Usage

```ts
import { db } from "@crm/db";

const users = await db.user.findMany({ take: 10 });
```

Types and query helpers come from the same entrypoint:

```ts
import { Prisma, type User } from "@crm/db";
```

## Setup

Copy the committed root environment template, generate the required secrets, then run:

```bash
bun run db:generate
bun run db:migrate
bun run db:seed
```

Local commands use Wrangler state under `packages/db/.wrangler`. The client
discovers its SQLite file automatically and uses `@prisma/adapter-libsql`.
Production uses `@prisma/adapter-d1` with the Cloudflare account, token, and
database ID.

## Scripts

| Script | Purpose |
| --- | --- |
| `build` | Generate Prisma Client and build the coordinator Worker |
| `coordinator:build` | Build the coordinator Worker |
| `coordinator:deploy` | Deploy the coordinator Worker |
| `coordinator:secret` | Configure the coordinator secret |
| `coordinator:test` | Run the coordinator Worker tests |
| `dev:prepare` | Apply local D1 migrations and generate Prisma Client |
| `db:generate` | Regenerate Prisma Client |
| `db:migration:create -- <name>` | Create a Wrangler migration file |
| `db:migrate` / `db:push` | Apply migrations to local D1 |
| `db:deploy` | Explicitly apply migrations to remote D1 |
| `db:reset` | Back up and rebuild local D1 |
| `db:seed` | Migrate and seed local D1 |
| `db:seed:remote` | Explicitly migrate and seed remote D1 |
| `db:studio` | Open Prisma Studio against local D1 |
| `db:test` | Rebuild the local test database and apply migrations |

Root scripts route these commands through Turborepo. Local reset backs up the
Wrangler state under `packages/db/.d1-backups`.

## Notes

- The SQLite Prisma schema is the model authority. Wrangler SQL files are the
  deployment authority because Prisma Migrate does not target D1.
- `src/client.ts` selects the local or remote adapter from the configured
  environment.
- `src/transaction-lease.ts` serializes Prisma transaction callbacks.
  `coordinator.ts` owns the authenticated Durable Object runtime.
- The coordinator prevents concurrent writers. It does not add rollback to a
  failed multi-statement D1 write.
- Generated code lives in `src/generated` and is not committed.
- Better Auth models come from `@better-auth/cli`. Change the auth config before
  regenerating those models.
