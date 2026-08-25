import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";

describe("Auth (e2e)", () => {
	let app: INestApplication;

	beforeAll(async () => {
		process.env.ALLOWED_SIGN_IN = "example.com";
		const { AppModule } = await import("../src/app.module");

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication({ bodyParser: false });
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	it("rejects an unauthenticated request to a guarded route", async () => {
		await request(app.getHttpServer()).get("/auth/me").expect(401);
	});

	it("allows an unauthenticated request to an optional-auth route", async () => {
		const response = await request(app.getHttpServer())
			.get("/auth/session")
			.expect(200);

		expect(response.body).toEqual({ authenticated: false, user: null });
	});

	it("mounts the Better Auth handler", async () => {
		const response = await request(app.getHttpServer()).get("/api/auth/ok");

		expect(response.status).not.toBe(404);
	});

	it("offers email registration without bypassing the sign-in allow-list", async () => {
		const response = await request(app.getHttpServer())
			.post("/api/auth/sign-up/email")
			.send({
				name: "Outside User",
				email: "outside@not-allowed.test",
				password: "valid-password",
			})
			.expect(403);

		expect(response.body.message).toBe(
			"This CRM is private. Sign in with your @example.com account.",
		);
	});

	it("lets the sign-in page read what it may offer", async () => {
		const response = await request(app.getHttpServer())
			.get("/api/trpc/sso.signInOptions")
			.expect(200);

		const microsoftConfigured = Boolean(
			process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET,
		);

		expect(response.body.result.data).toEqual({
			google: true,
			microsoft: microsoftConfigured,
			providers: [],
		});
	});

	it("keeps the SSO configuration itself behind the session", async () => {
		const response = await request(app.getHttpServer()).get(
			"/api/trpc/sso.settings",
		);

		expect(response.status).toBe(401);
	});
});
