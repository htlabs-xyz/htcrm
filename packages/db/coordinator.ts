import { DurableObject } from "cloudflare:workers";

interface CoordinatorEnvironment {
	D1_COORDINATOR_SECRET?: string;
	LEASES: DurableObjectNamespace<LeaseCoordinator>;
}

interface Lease {
	expiresAt: number;
	token: string;
}

interface AcquireResult {
	acquired: boolean;
	expiresAt: number;
	retryAfterMs?: number;
	token?: string;
}

type JsonPrimitive = boolean | number | string | null;
type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;

interface JsonObject {
	[key: string]: JsonValue;
}

type CoordinatorResponse =
	| AcquireResult
	| { error: string }
	| { ok: boolean }
	| { released: boolean };

const minimumLeaseMs = 1_000;
const maximumLeaseMs = 120_000;

export class LeaseCoordinator extends DurableObject<CoordinatorEnvironment> {
	async acquire(ttlMs: number): Promise<AcquireResult> {
		const now = Date.now();
		const current = await this.ctx.storage.get<Lease>("lease");

		if (current && current.expiresAt > now) {
			return {
				acquired: false,
				expiresAt: current.expiresAt,
				retryAfterMs: current.expiresAt - now,
			};
		}

		const duration = Math.min(
			maximumLeaseMs,
			Math.max(minimumLeaseMs, Math.trunc(ttlMs)),
		);
		const lease = {
			expiresAt: now + duration,
			token: crypto.randomUUID(),
		};
		await this.ctx.storage.put("lease", lease);
		await this.ctx.storage.setAlarm(lease.expiresAt);

		return { acquired: true, ...lease };
	}

	async renew(token: string, ttlMs: number): Promise<AcquireResult> {
		const current = await this.ctx.storage.get<Lease>("lease");
		const now = Date.now();

		if (!current || current.token !== token || current.expiresAt <= now) {
			return { acquired: false, expiresAt: current?.expiresAt ?? now };
		}

		const duration = Math.min(
			maximumLeaseMs,
			Math.max(minimumLeaseMs, Math.trunc(ttlMs)),
		);
		const renewed = { token, expiresAt: now + duration };
		await this.ctx.storage.put("lease", renewed);
		await this.ctx.storage.setAlarm(renewed.expiresAt);

		return { acquired: true, ...renewed };
	}

	async release(token: string): Promise<boolean> {
		const current = await this.ctx.storage.get<Lease>("lease");
		if (!current || current.token !== token) return false;

		await this.ctx.storage.delete("lease");
		await this.ctx.storage.deleteAlarm();
		return true;
	}

	async alarm(): Promise<void> {
		const current = await this.ctx.storage.get<Lease>("lease");
		if (!current) return;

		if (current.expiresAt <= Date.now()) {
			await this.ctx.storage.delete("lease");
			return;
		}

		await this.ctx.storage.setAlarm(current.expiresAt);
	}
}

function authorized(request: Request, secret: string): boolean {
	const provided = request.headers.get("authorization") ?? "";
	const expected = `Bearer ${secret}`;
	if (provided.length !== expected.length) return false;

	let difference = 0;
	for (let index = 0; index < expected.length; index++) {
		difference |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
	}
	return difference === 0;
}

function isJsonObject(value: JsonValue): value is JsonObject {
	return (
		value !== null &&
		!Array.isArray(value) &&
		Object.prototype.toString.call(value) === "[object Object]"
	);
}

function isString(value: JsonValue | undefined): value is string {
	return Object.prototype.toString.call(value) === "[object String]";
}

function isFiniteNumber(value: JsonValue | undefined): value is number {
	return (
		Object.prototype.toString.call(value) === "[object Number]" &&
		Number.isFinite(value as number)
	);
}

async function body(request: Request): Promise<JsonObject> {
	const value = await request.json<JsonValue>();
	if (!isJsonObject(value)) {
		throw new Error("The request body must be a JSON object.");
	}
	return value;
}

function json(value: CoordinatorResponse, status = 200): Response {
	return Response.json(value, { status });
}

export default {
	async fetch(request, environment): Promise<Response> {
		const url = new URL(request.url);
		const secret = environment.D1_COORDINATOR_SECRET;
		const configured = isString(secret) && secret.length >= 32;
		if (request.method === "GET" && url.pathname === "/health") {
			return json({ ok: configured }, configured ? 200 : 503);
		}

		if (!configured) {
			return json({ error: "Coordinator secret is not configured." }, 503);
		}

		if (!authorized(request, secret)) {
			return json({ error: "Unauthorized." }, 401);
		}

		if (request.method !== "POST") {
			return json({ error: "Method not allowed." }, 405);
		}

		try {
			const input = await body(request);
			const key = input.key;
			if (!isString(key) || key.length === 0 || key.length > 256) {
				return json({ error: "key must contain 1 to 256 characters." }, 400);
			}

			const coordinator = environment.LEASES.getByName(key);
			if (url.pathname === "/leases/acquire") {
				const ttlMs = input.ttlMs;
				if (!isFiniteNumber(ttlMs)) {
					return json({ error: "ttlMs must be a finite number." }, 400);
				}
				const result = await coordinator.acquire(ttlMs);
				return json(result, result.acquired ? 201 : 409);
			}

			if (url.pathname === "/leases/renew") {
				const ttlMs = input.ttlMs;
				const token = input.token;
				if (!isFiniteNumber(ttlMs) || !isString(token)) {
					return json({ error: "token and ttlMs are required." }, 400);
				}
				const result = await coordinator.renew(token, ttlMs);
				return json(result, result.acquired ? 200 : 409);
			}

			if (url.pathname === "/leases/release") {
				const token = input.token;
				if (!isString(token)) {
					return json({ error: "token is required." }, 400);
				}
				const released = await coordinator.release(token);
				return json({ released }, released ? 200 : 409);
			}

			return json({ error: "Not found." }, 404);
		} catch (error) {
			return json(
				{ error: error instanceof Error ? error.message : "Invalid request." },
				400,
			);
		}
	},
} satisfies ExportedHandler<CoordinatorEnvironment>;
