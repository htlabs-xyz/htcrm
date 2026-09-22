import { z } from "zod";
import { DEEPSEEK_MODELS } from "./byok-models";
import {
	AI_GATEWAY,
	gatewayAccountUrl,
	gatewayBaseUrl,
	gatewayId,
} from "./config";

export const requestFormat = z.enum([
	"chat-completions",
	"responses",
	"anthropic-messages",
]);

export const gatewayModel = z.object({
	id: z.string(),
	name: z.string(),
	provider: z.string(),
	contextWindowTokens: z.number().int().positive(),
	maxOutputTokens: z.number().int().positive().nullable(),
	requestFormat,
	pricing: z.object({ input: z.number(), output: z.number() }).nullable(),
});

export type GatewayModel = z.infer<typeof gatewayModel>;
export type RequestFormat = z.infer<typeof requestFormat>;

const catalogEntry = z.object({
	model_id: z.string().min(1),
	provider_id: z.string().min(1),
	name: z.string(),
	task: z.string(),
	context_length: z.number().int().positive(),
	max_output_tokens: z.number().int().positive().nullish(),
	request_formats: z.array(z.string()),
	pricing: z.record(z.string(), z.number().nonnegative()).nullish(),
});

const catalogPage = z.object({
	success: z.literal(true),
	result: z.array(z.json()),
	result_info: z.object({ total_count: z.number().int().nonnegative() }),
});

const providerConfig = z.object({
	provider_slug: z.string(),
	alias: z.string(),
});
const nativeModels = z.object({ data: z.array(z.object({ id: z.string() })) });

export class GatewayCatalogError extends Error {
	constructor(readonly status: number) {
		super(
			status === 401 || status === 403
				? "Cloudflare refused this key. Use a token with Workers AI Read, AI Gateway Read, and AI Gateway Run for this account. Check the stored provider key too."
				: "Could not load Cloudflare models. Check the account, token permissions, and connection, then try again.",
		);
	}
}

export function parseCatalogModel(
	value: z.infer<typeof catalogPage>["result"][number],
): GatewayModel | null {
	const parsed = catalogEntry.safeParse(value);
	if (!parsed.success || parsed.data.task !== "Text Generation") return null;
	const model = parsed.data;
	const format = model.request_formats
		.map((entry) => requestFormat.safeParse(entry))
		.find((entry) => entry.success)?.data;
	if (!format) return null;
	const input = model.pricing?.["Input tokens (per 1M)"];
	const output = model.pricing?.["Output tokens (per 1M)"];
	return {
		id: model.model_id,
		name: model.name || model.model_id,
		provider: model.provider_id,
		contextWindowTokens: model.context_length,
		maxOutputTokens: model.max_output_tokens ?? null,
		requestFormat: format,
		pricing:
			input !== undefined && output !== undefined
				? { input: input / 1_000_000, output: output / 1_000_000 }
				: null,
	};
}

async function readGatewayJson(
	url: URL | string,
	apiToken: string,
	request: typeof fetch,
	native = false,
) {
	let response: Response;
	try {
		response = await request(url, {
			headers: {
				[native ? "cf-aig-authorization" : "authorization"]:
					`Bearer ${apiToken}`,
				"cf-aig-no-wholesale": "true",
				"cf-aig-skip-cache": "true",
				accept: "application/json",
			},
			signal: AbortSignal.timeout(AI_GATEWAY.catalogTimeoutMs),
			redirect: "error",
		});
	} catch {
		throw new GatewayCatalogError(0);
	}
	if (!response.ok) {
		await response.body?.cancel();
		throw new GatewayCatalogError(response.status);
	}
	return response.json().catch(() => null);
}

async function readPages(url: URL, apiToken: string, request: typeof fetch) {
	const entries: z.infer<typeof catalogPage>["result"] = [];
	let seen = 0;
	for (let page = 1; page <= AI_GATEWAY.catalogMaxPages; page++) {
		url.searchParams.set("per_page", String(AI_GATEWAY.catalogPageSize));
		url.searchParams.set("page", String(page));
		const parsed = catalogPage.safeParse(
			await readGatewayJson(url, apiToken, request),
		);
		if (!parsed.success) throw new GatewayCatalogError(0);
		entries.push(...parsed.data.result);
		seen += parsed.data.result.length;
		if (seen >= parsed.data.result_info.total_count) return entries;
		if (!parsed.data.result.length) throw new GatewayCatalogError(0);
	}
	throw new GatewayCatalogError(0);
}

export async function fetchGatewayCatalog(
	accountId: string,
	apiToken: string,
	request: typeof fetch = fetch,
	gatewayName = gatewayId(),
): Promise<GatewayModel[]> {
	const nativeBase = gatewayBaseUrl(accountId, gatewayName);
	const base = gatewayAccountUrl(accountId);
	const configs = await readPages(
		new URL(`${base}/ai-gateway/gateways/${gatewayName}/provider_configs`),
		apiToken,
		request,
	);
	const providers = new Set<string>();
	for (const value of configs) {
		const parsed = providerConfig.safeParse(value);
		if (!parsed.success) throw new GatewayCatalogError(0);
		if (parsed.data.alias === "default")
			providers.add(
				parsed.data.provider_slug === "google-ai-studio"
					? "google"
					: parsed.data.provider_slug,
			);
	}
	if (!providers.size) return [];
	const models = new Map<string, GatewayModel>();
	if ([...providers].some((provider) => provider !== "deepseek")) {
		const url = new URL(`${base}/ai/catalog/models`);
		url.searchParams.set("task", "Text Generation");
		for (const entry of await readPages(url, apiToken, request)) {
			const model = parseCatalogModel(entry);
			if (
				model &&
				model.provider !== "deepseek" &&
				providers.has(model.provider)
			)
				models.set(model.id, { ...model, pricing: null });
		}
	}
	if (providers.has("deepseek")) {
		const parsed = nativeModels.safeParse(
			await readGatewayJson(
				`${nativeBase}/deepseek/models`,
				apiToken,
				request,
				true,
			),
		);
		if (!parsed.success) throw new GatewayCatalogError(0);
		const available = new Set(
			parsed.data.data.map((model) => `deepseek/${model.id}`),
		);
		for (const model of DEEPSEEK_MODELS)
			if (available.has(model.id)) models.set(model.id, model);
	}
	return [...models.values()].sort(
		(a, b) =>
			a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name),
	);
}
