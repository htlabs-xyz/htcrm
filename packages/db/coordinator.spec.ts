import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const authorization = {
	authorization: "Bearer test-coordinator-secret-32-characters",
	"content-type": "application/json",
};

interface LeaseRequestBody {
	key: string;
	token?: string;
	ttlMs?: number;
}

function request(path: string, body: LeaseRequestBody) {
	return SELF.fetch(`https://coordinator.test${path}`, {
		method: "POST",
		headers: authorization,
		body: JSON.stringify(body),
	});
}

describe("D1 coordinator", () => {
	it("reports a healthy configured coordinator", async () => {
		const response = await SELF.fetch("https://coordinator.test/health");
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
	});

	it("rejects requests without the shared secret", async () => {
		const response = await SELF.fetch(
			"https://coordinator.test/leases/acquire",
			{
				method: "POST",
			},
		);
		expect(response.status).toBe(401);
	});

	it("allows only one active lease for a key", async () => {
		const key = crypto.randomUUID();
		const responses = await Promise.all([
			request("/leases/acquire", { key, ttlMs: 10_000 }),
			request("/leases/acquire", { key, ttlMs: 10_000 }),
		]);
		expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
	});

	it("requires the current token to release a lease", async () => {
		const key = crypto.randomUUID();
		const acquired = await request("/leases/acquire", { key, ttlMs: 10_000 });
		const lease = await acquired.json<{ token: string }>();

		const rejected = await request("/leases/release", {
			key,
			token: crypto.randomUUID(),
		});
		expect(rejected.status).toBe(409);

		const released = await request("/leases/release", {
			key,
			token: lease.token,
		});
		expect(released.status).toBe(200);

		const reacquired = await request("/leases/acquire", { key, ttlMs: 10_000 });
		expect(reacquired.status).toBe(201);
	});

	it("renews only the current lease", async () => {
		const key = crypto.randomUUID();
		const acquired = await request("/leases/acquire", { key, ttlMs: 1_000 });
		const lease = await acquired.json<{ expiresAt: number; token: string }>();

		const renewed = await request("/leases/renew", {
			key,
			token: lease.token,
			ttlMs: 10_000,
		});
		const result = await renewed.json<{ expiresAt: number }>();
		expect(renewed.status).toBe(200);
		expect(result.expiresAt).toBeGreaterThan(lease.expiresAt);
	});

	it("allows a lease to be acquired after expiry", async () => {
		const key = crypto.randomUUID();
		const acquired = await request("/leases/acquire", { key, ttlMs: 1_000 });
		const lease = await acquired.json<{ token: string }>();

		await new Promise((resolve) => setTimeout(resolve, 1_100));

		const reacquired = await request("/leases/acquire", { key, ttlMs: 1_000 });
		const nextLease = await reacquired.json<{ token: string }>();
		expect(reacquired.status).toBe(201);
		expect(nextLease.token).not.toBe(lease.token);
	});
});
