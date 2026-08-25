import { join } from "node:path";

const directory = join(import.meta.dir, "..");
const migration = await execute([
	process.execPath,
	"scripts/d1-command.ts",
	"migrate",
	"--local",
]);
if (migration !== 0) process.exit(migration);

const generation = await execute([
	process.execPath,
	"run",
	"prisma",
	"generate",
]);
if (generation !== 0) process.exit(generation);

console.log("Local D1 migrations and generated Prisma client are ready.");

async function execute(command: string[]): Promise<number> {
	const child = Bun.spawn(command, {
		cwd: directory,
		env: process["env"],
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
	});

	return child.exited;
}
