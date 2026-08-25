import "reflect-metadata";

import { describe, expect, it } from "bun:test";
import { NodeEnv, validateEnv } from "../src/config/env.validation";

const productionEnvironment = {
	NODE_ENV: NodeEnv.Production,
	CLOUDFLARE_ACCOUNT_ID: "account-id",
	CLOUDFLARE_DATABASE_ID: "database-id",
	D1_COORDINATOR_URL: "https://coordinator.example.com",
	D1_COORDINATOR_SECRET: "c".repeat(32),
	BETTER_AUTH_SECRET: "a".repeat(32),
	ALLOWED_SIGN_IN: "example.com",
};

describe("D1 environment validation", () => {
	it("accepts the Cloudflare token alias when the canonical value is empty", () => {
		const environment = validateEnv({
			...productionEnvironment,
			CLOUDFLARE_D1_TOKEN: "",
			CLOUDFLARE_TOKEN: "alias-token",
		});

		expect(environment.CLOUDFLARE_TOKEN).toBe("alias-token");
	});

	it("rejects an incomplete production D1 configuration", () => {
		expect(() =>
			validateEnv({
				...productionEnvironment,
				CLOUDFLARE_TOKEN: "",
			}),
		).toThrow(
			"CLOUDFLARE_ACCOUNT_ID, a Cloudflare token, and CLOUDFLARE_DATABASE_ID must be set together.",
		);
	});

	it("rejects a local SQLite override in production", () => {
		expect(() =>
			validateEnv({
				...productionEnvironment,
				CLOUDFLARE_TOKEN: "alias-token",
				D1_LOCAL_DATABASE_PATH: "/tmp/ephemeral.sqlite",
			}),
		).toThrow("D1_LOCAL_DATABASE_PATH cannot be used in production.");
	});
});
