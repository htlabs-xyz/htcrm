import { env } from "node:process";

export const AI_GATEWAY = {
	apiOrigin: "https://api.cloudflare.com/client/v4",
	gatewayOrigin: "https://gateway.ai.cloudflare.com/v1",
	catalogTtlMs: 30 * 60_000,
	catalogTimeoutMs: 10_000,
	catalogPageSize: 100,
	catalogMaxPages: 100,
} as const;

export function gatewayId(): string | null {
	const id = env.CLOUDFLARE_GATEWAY_ID?.trim();
	return id && id.length <= 64 && /^[a-z0-9_]+(?:-[a-z0-9_]+)*$/.test(id)
		? id
		: null;
}

export function gatewayBaseUrl(accountId: string, id: string | null): string {
	gatewayAccountUrl(accountId);
	if (!id || id.length > 64 || !/^[a-z0-9_]+(?:-[a-z0-9_]+)*$/.test(id)) {
		throw new Error("Configure CLOUDFLARE_GATEWAY_ID on the CRM server.");
	}
	return `${AI_GATEWAY.gatewayOrigin}/${accountId}/${id}`;
}

export function gatewayAccountId(): string | null {
	const id = env.CLOUDFLARE_ACCOUNT_ID?.trim();
	return id && /^[a-f0-9]{32}$/i.test(id) ? id : null;
}

export function gatewayAccountUrl(accountId: string): string {
	if (!/^[a-f0-9]{32}$/i.test(accountId)) {
		throw new Error("Configure CLOUDFLARE_ACCOUNT_ID on the CRM server.");
	}
	return `${AI_GATEWAY.apiOrigin}/accounts/${accountId}`;
}
