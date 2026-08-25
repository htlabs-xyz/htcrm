import "@crm/env/load";

import { join } from "node:path";
import { findLocalD1Database } from "../src/local-d1";

const packageDirectory = join(import.meta.dir, "..");
const child = Bun.spawn(
	[process.execPath, "scripts/d1-command.ts", "reset", "--local"],
	{
		cwd: packageDirectory,
		env: process["env"],
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
	},
);

const exitCode = await child.exited;
if (exitCode !== 0) process.exit(exitCode);

const database = findLocalD1Database();
if (!database) {
	console.error("The local D1 test database was not created.");
	process.exit(1);
}

console.log(`Local D1 test database: ${database}`);
