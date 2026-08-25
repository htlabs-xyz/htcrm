import { afterAll } from "bun:test";

Object.assign(process.env, { ALLOWED_SIGN_IN: "example.com" });
afterAll(async () => {
	if (!process.env.DATABASE_URL) return;
	const { db } = await import("@crm/db");
	await db.$disconnect();
});
