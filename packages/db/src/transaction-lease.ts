import "@crm/env/load";

const runtimeEnvironment = process["env"];
const runningTests = runtimeEnvironment.NODE_ENV === "test";
const leaseKey = "prisma-transactions";
const leaseTtlMs = 120_000;
const acquireTimeoutMs = 125_000;

interface LeaseResult {
	acquired: boolean;
	expiresAt: number;
	retryAfterMs?: number;
	token?: string;
}

const localQueues = new Map<string, Promise<void>>();

function delay(durationMs: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, durationMs));
}

async function withLocalLease<T>(work: () => Promise<T>): Promise<T> {
	const previous = localQueues.get(leaseKey) ?? Promise.resolve();
	let release: () => void = () => undefined;
	const current = new Promise<void>((resolve) => {
		release = resolve;
	});
	const tail = previous.then(() => current);
	localQueues.set(leaseKey, tail);
	await previous;

	try {
		return await work();
	} finally {
		release();
		if (localQueues.get(leaseKey) === tail) localQueues.delete(leaseKey);
	}
}

function coordinatorConfiguration(): { secret: string; url: string } | null {
	if (runningTests) return null;

	const url = runtimeEnvironment.D1_COORDINATOR_URL;
	const secret = runtimeEnvironment.D1_COORDINATOR_SECRET;
	if (!url && !secret && runtimeEnvironment.NODE_ENV !== "production")
		return null;

	if (!url || !secret) {
		throw new Error(
			"D1_COORDINATOR_URL and D1_COORDINATOR_SECRET must both be set when distributed transaction coordination is enabled.",
		);
	}

	return { secret, url: url.replace(/\/$/, "") };
}

async function coordinatorRequest(
	configuration: { secret: string; url: string },
	path: string,
	body: Record<string, unknown>,
): Promise<Response> {
	return fetch(`${configuration.url}${path}`, {
		method: "POST",
		headers: {
			authorization: `Bearer ${configuration.secret}`,
			"content-type": "application/json",
		},
		body: JSON.stringify(body),
	});
}

async function acquireRemoteLease(configuration: {
	secret: string;
	url: string;
}): Promise<string> {
	const deadline = Date.now() + acquireTimeoutMs;

	while (Date.now() < deadline) {
		const response = await coordinatorRequest(
			configuration,
			"/leases/acquire",
			{ key: leaseKey, ttlMs: leaseTtlMs },
		);
		const result = (await response.json()) as LeaseResult;
		if (response.status === 201 && result.acquired && result.token) {
			return result.token;
		}
		if (response.status !== 409) {
			throw new Error(
				`The D1 coordinator rejected a lease request with status ${response.status}.`,
			);
		}

		const retryAfterMs = Math.min(
			250,
			Math.max(25, result.retryAfterMs ?? 100),
		);
		await delay(retryAfterMs);
	}

	throw new Error("Timed out while waiting for the D1 transaction lease.");
}

async function releaseRemoteLease(
	configuration: { secret: string; url: string },
	token: string,
): Promise<void> {
	const response = await coordinatorRequest(configuration, "/leases/release", {
		key: leaseKey,
		token,
	});
	if (!response.ok) {
		throw new Error(
			`The D1 coordinator rejected a lease release with status ${response.status}.`,
		);
	}
}

async function renewRemoteLease(
	configuration: { secret: string; url: string },
	token: string,
): Promise<void> {
	const response = await coordinatorRequest(configuration, "/leases/renew", {
		key: leaseKey,
		token,
		ttlMs: leaseTtlMs,
	});
	if (!response.ok) {
		throw new Error(
			`The D1 coordinator rejected a lease renewal with status ${response.status}.`,
		);
	}
}

export async function withTransactionCoordination<T>(
	work: () => Promise<T>,
): Promise<T> {
	const configuration = coordinatorConfiguration();
	if (!configuration) return withLocalLease(work);

	const token = await acquireRemoteLease(configuration);
	let failed = false;
	let result: T | undefined;
	let workError: unknown;
	let renewing = false;
	let renewalError: unknown;
	let renewal = Promise.resolve();
	const renewalTimer = setInterval(() => {
		if (renewing) return;
		renewing = true;
		renewal = renewRemoteLease(configuration, token)
			.catch((error: unknown) => {
				renewalError = error;
			})
			.finally(() => {
				renewing = false;
			});
	}, leaseTtlMs / 3);

	try {
		result = await work();
	} catch (error) {
		failed = true;
		workError = error;
	}

	clearInterval(renewalTimer);
	await renewal;
	let releaseError: unknown;
	try {
		await releaseRemoteLease(configuration, token);
	} catch (error) {
		releaseError = error;
	}

	if (failed) throw workError;
	if (releaseError) throw releaseError;
	if (renewalError) throw renewalError;
	return result as T;
}
