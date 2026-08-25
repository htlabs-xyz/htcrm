import "@crm/env/load";

import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { findLocalD1Database } from "../src/local-d1";

const packageDirectory = join(import.meta.dir, "..");
const stateDirectory = join(packageDirectory, ".wrangler");
const runtimeEnvironment = process["env"];
const operation = process.argv[2];
const mode = process.argv.includes("--remote") ? "--remote" : "--local";

if (!operation) fail("A D1 operation is required.");
if (mode === "--remote" && process.argv.includes("--local")) {
	fail("Choose either --local or --remote.");
}

const databaseName = required("CLOUDFLARE_DATABASE_NAME");
const configPath = await writeWranglerConfig();

switch (operation) {
	case "create": {
		const migrationName = process.argv[3];
		if (!migrationName || migrationName.startsWith("--")) {
			fail("Pass a migration name after db:migration:create.");
		}
		await run([
			"wrangler",
			"--config",
			configPath,
			"d1",
			"migrations",
			"create",
			databaseName,
			migrationName,
		]);
		break;
	}
	case "migrate":
		await migrate();
		break;
	case "reset":
		if (mode !== "--local") fail("D1 reset only supports --local.");
		backupLocalState();
		rmSync(stateDirectory, { recursive: true, force: true });
		await migrate();
		break;
	case "seed":
		await migrate();
		if (mode === "--local") {
			await run(["bun", "prisma/seed.ts"], {
				D1_LOCAL_DATABASE_PATH: requireLocalDatabase(),
			});
		} else {
			await run(["bun", "prisma/seed.ts"]);
		}
		break;
	case "studio":
		if (mode !== "--local") fail("Prisma Studio only supports local D1.");
		await migrate();
		await run(["prisma", "studio", "--url", `file:${requireLocalDatabase()}`]);
		break;
	default:
		fail(`Unknown D1 operation: ${operation}`);
}

async function migrate(): Promise<void> {
	await run([
		"wrangler",
		"--config",
		configPath,
		"d1",
		"migrations",
		"apply",
		databaseName,
		mode,
	]);
}

async function writeWranglerConfig(): Promise<string> {
	const path = join(packageDirectory, "wrangler.generated.jsonc");
	const databaseId =
		mode === "--remote"
			? required("CLOUDFLARE_DATABASE_ID")
			: "00000000-0000-0000-0000-000000000000";
	await Bun.write(
		path,
		`${JSON.stringify(
			{
				name: "htcrm-db-tools",
				compatibility_date: "2026-08-20",
				d1_databases: [
					{
						binding: "DB",
						database_name: databaseName,
						database_id: databaseId,
						migrations_dir: "prisma/migrations",
					},
				],
			},
			null,
			2,
		)}\n`,
	);
	return path;
}

function backupLocalState(): void {
	if (!existsSync(stateDirectory)) return;
	const backup = join(
		packageDirectory,
		".d1-backups",
		new Date().toISOString().replaceAll(":", "-"),
	);
	cpSync(stateDirectory, backup, { recursive: true });
	console.log(`Local D1 backup: ${backup}`);
}

function requireLocalDatabase(): string {
	const database = findLocalD1Database();
	if (database) return database;
	fail(`Expected one local D1 database under ${stateDirectory}.`);
}

async function run(
	command: string[],
	extraEnvironment: Record<string, string> = {},
): Promise<void> {
	const cloudflareToken =
		runtimeEnvironment.CLOUDFLARE_D1_TOKEN?.trim() ||
		runtimeEnvironment.CLOUDFLARE_TOKEN?.trim();
	const childEnvironment = {
		...runtimeEnvironment,
		...extraEnvironment,
	};
	if (cloudflareToken) {
		childEnvironment.CLOUDFLARE_API_TOKEN = cloudflareToken;
	}
	const child = Bun.spawn(command, {
		cwd: packageDirectory,
		env: childEnvironment,
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
	});
	const exitCode = await child.exited;
	if (exitCode !== 0) process.exit(exitCode);
}

function required(name: string): string {
	const value = runtimeEnvironment[name];
	if (value) return value;
	fail(`${name} is required for D1 commands.`);
}

function fail(message: string): never {
	console.error(message);
	process.exit(1);
}
