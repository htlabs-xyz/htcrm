import { env } from "node:process";

export const AI_GATEWAY = {
	apiOrigin: "https://api.cloudflare.com/client/v4",
	catalogTtlMs: 30 * 60_000,
	catalogTimeoutMs: 10_000,
	catalogPageSize: 100,
	catalogMaxPages: 100,
} as const;

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
