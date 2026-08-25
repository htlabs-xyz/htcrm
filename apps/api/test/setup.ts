import "@crm/env/load";

import { afterAll } from "bun:test";

for (const key of [
	"CLOUDFLARE_ACCOUNT_ID",
	"CLOUDFLARE_DATABASE_ID",
	"CLOUDFLARE_D1_TOKEN",
	"CLOUDFLARE_TOKEN",
	"D1_COORDINATOR_URL",
	"D1_COORDINATOR_SECRET",
]) {
	delete process.env[key];
}

const fallback = (key: string, value: string) => {
	if (!process["env"][key]) process["env"][key] = value;
};

fallback("BETTER_AUTH_SECRET", "test-secret-at-least-32-characters-long");
fallback("API_URL", "http://localhost:3001");
Object.assign(process.env, { ALLOWED_SIGN_IN: "example.com" });
fallback("GOOGLE_CLIENT_ID", "test-google-client-id");
fallback("GOOGLE_CLIENT_SECRET", "test-google-client-secret");

afterAll(async () => {
	const { db } = await import("@crm/db");
	await db.$disconnect();
});
