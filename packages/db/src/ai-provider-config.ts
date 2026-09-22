export const AI_PROVIDER = {
	unconfiguredContextTokens: 1024,
	requestTimeoutMs: 120_000,
	catalogTimeoutMs: 10_000,
	verifyTimeoutMs: 120_000,
	bridgeTimeoutMs: 125_000,
	maxCatalogBytes: 2_000_000,
	maxCatalogModels: 2_000,
	maxRequestBytes: 32_000_000,
	maxContextTokens: 10_000_000,
	maxOutputTokens: 1_000_000,
	verifyOutputTokens: 4096,
} as const;
