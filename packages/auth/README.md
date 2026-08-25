# `@crm/auth`

[Better Auth](https://better-auth.com) configuration for the monorepo, backed by
`@crm/db`.

Enabled: email/password registration and sign-in, Google and Microsoft sign-in,
enterprise SSO, account linking, cookie-cached sessions, and database-backed
rate limiting. This is an internal, single-workspace app; every new identity is
still restricted by `ALLOWED_SIGN_IN`.

## Topology

The **NestJS API** (`apps/api`, port 3001) mounts `/api/auth/*` via
`@thallesp/nestjs-better-auth` and is the only process that writes session
cookies. The **Next.js app** (`apps/app`, port 3000) imports this package on the
server to *read* sessions from D1, and points its browser client
at the API for sign-in and sign-out.

Both processes therefore need the same `BETTER_AUTH_SECRET` and D1 configuration,
or the cookie one writes will not verify in the other. Transaction-sensitive writes
also use the shared D1 coordinator.

## Usage

### Server

```ts
import { auth } from "@crm/auth";

// Session for an incoming request
const session = await auth.api.getSession({ headers: request.headers });
```

`auth.handler` is a standard `(Request) => Promise<Response>` function, so it
mounts anywhere. In a Next.js App Router route (`app/api/auth/[...all]/route.ts`):

```ts
import { auth } from "@crm/auth";

export const GET = auth.handler;
export const POST = auth.handler;
```

### Client

```ts
import { signIn, signOut, signUp, useSession } from "@crm/auth/client";

await signUp.email({
	name: "Ada",
	email: "ada@acme.com",
	password: "correct-horse-battery-staple",
});
await signIn.email({
	email: "ada@acme.com",
	password: "correct-horse-battery-staple",
});
await signIn.social({ provider: "google", callbackURL: "/" });
```

The browser client uses the current origin and the Next.js `/api` proxy. In a
container deployment, `NEXT_PUBLIC_API_URL` stays `/api`, while the Next.js server
uses `API_URL` to reach the NestJS API through the private network. The API process
uses its public `API_URL` when it creates OAuth callback URLs.

The client plugin list mirrors the server plugin list. Keep them in sync or the
inferred client API will drift from the routes the server exposes.

## Setup

```bash
cp .env.example .env      # at the repo root — there is no per-package env file
openssl rand -base64 32   # -> BETTER_AUTH_SECRET
```

This package is a library and never loads an env file of its own; it reads
whatever `process.env` its host process has, and `src/env.ts` imports
`@crm/env/load` so the repo-root `.env` is picked up even when the Better Auth
CLI loads `auth.ts` directly. See
[`docs/environment.md`](../../docs/environment.md).

Create an OAuth client in the Google Cloud console and add
`<API_URL>/api/auth/callback/google` — `http://localhost:3001/api/auth/callback/google`
in development — as an authorised redirect URI.

`ALLOWED_SIGN_IN` decides who may register or sign in, and an empty value admits
nobody. Email/password registration uses Better Auth's default password limits
(8 to 128 characters). Email verification and password reset are not enabled
because this project does not configure an email delivery service.

## Changing the schema

Adding a plugin or an additional user field changes the database schema. After
editing `src/auth.ts`:

```bash
bun run auth:generate   # rewrites packages/db/prisma/schema.prisma
bun run db:migration:create -- <name>
bun run db:migrate
```

## Notes

- **JIT package.** `exports` point at TypeScript sources, which keeps Better
  Auth's inferred types intact — declaration emit tends to break them.
  Turbopack transpiles workspace packages automatically, so a Next.js app needs
  no `transpilePackages` entry.
- **Next.js server actions** need the `nextCookies()` plugin (from
  `better-auth/next-js`) as the *last* entry in the plugin array. It is omitted
  here so the package stays framework-agnostic; add it — along with `next` as a
  dependency — once an app relies on setting cookies from server actions.
- **Cross-origin cookies.** On localhost the API and the app differ only by
  port, which cookies ignore. Deployed on separate subdomains they need
  `AUTH_COOKIE_DOMAIN` set to the shared parent (`.example.com`).
