import "@crm/env/load";

import path from "node:path";
import { defineConfig } from "prisma/config";

const localDatabase = process["env"].D1_LOCAL_DATABASE_PATH;

export default defineConfig({
	schema: path.join("prisma", "schema.prisma"),
	migrations: {
		path: path.join("prisma", "migrations"),
	},
	datasource: {
		url: localDatabase
			? `file:${localDatabase}`
			: "file:./d1-placeholder.sqlite",
	},
});
