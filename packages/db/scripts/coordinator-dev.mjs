import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const runtimeEnvironment = process.env;
const secret = runtimeEnvironment.D1_COORDINATOR_SECRET?.trim();

if (!secret || secret.length < 32) {
	throw new Error("D1_COORDINATOR_SECRET must contain at least 32 characters.");
}

const temporaryDirectory = mkdtempSync(join(tmpdir(), "htcrm-db-coordinator-"));
const environmentPath = join(temporaryDirectory, "coordinator.env");
writeFileSync(
	environmentPath,
	`D1_COORDINATOR_SECRET=${JSON.stringify(secret)}\n`,
	{ mode: 0o600 },
);

const childEnvironment = { ...runtimeEnvironment };
delete childEnvironment.D1_COORDINATOR_SECRET;

const child = spawn(
	process.execPath,
	[
		"x",
		"wrangler",
		"dev",
		"--config",
		"coordinator-wrangler.jsonc",
		"--port",
		"8788",
		"--env-file",
		environmentPath,
	],
	{
		cwd: new URL("..", import.meta.url),
		env: childEnvironment,
		stdio: "inherit",
	},
);

const stopWithInterrupt = () => child.kill("SIGINT");
const stopWithTermination = () => child.kill("SIGTERM");
process.once("SIGINT", stopWithInterrupt);
process.once("SIGTERM", stopWithTermination);

try {
	const exitCode = await new Promise((resolve, reject) => {
		child.once("error", reject);
		child.once("exit", (code) => resolve(code ?? 1));
	});
	process.exitCode = exitCode;
} finally {
	process.removeListener("SIGINT", stopWithInterrupt);
	process.removeListener("SIGTERM", stopWithTermination);
	rmSync(temporaryDirectory, { force: true, recursive: true });
}
