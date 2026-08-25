import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["coordinator.spec.ts"],
	},
	plugins: [
		cloudflareTest({
			miniflare: {
				bindings: {
					D1_COORDINATOR_SECRET: "test-coordinator-secret-32-characters",
				},
			},
			wrangler: {
				configPath: "./coordinator-wrangler.jsonc",
			},
		}),
	],
});
