import { type Dirent, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const stateDirectory = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	".wrangler",
);

export function findLocalD1Database(): string | null {
	const databases = findSqliteFiles(stateDirectory);
	return databases.length === 1 ? (databases[0] ?? null) : null;
}

function findSqliteFiles(directory: string): string[] {
	const files: string[] = [];
	let entries: Dirent[];

	try {
		entries = readdirSync(directory, { withFileTypes: true });
	} catch {
		return files;
	}

	for (const entry of entries) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...findSqliteFiles(path));
		} else if (
			entry.name.endsWith(".sqlite") &&
			entry.name !== "metadata.sqlite" &&
			path.includes("miniflare-D1DatabaseObject")
		) {
			files.push(path);
		}
	}

	return files;
}
