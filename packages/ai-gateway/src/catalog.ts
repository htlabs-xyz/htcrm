import { z } from "zod";
import { AI_GATEWAY, gatewayAccountUrl } from "./config";

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

export class GatewayCatalogError extends Error {
	constructor(readonly status: number) {
		super(
			status === 401 || status === 403
				? "Cloudflare refused this key. Use a token with Workers AI Read for this account."
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

export async function fetchGatewayCatalog(
	accountId: string,
	apiToken: string,
	request: typeof fetch = fetch,
): Promise<GatewayModel[]> {
	const base = gatewayAccountUrl(accountId);
	const models = new Map<string, GatewayModel>();
	let seen = 0;
	for (let page = 1; page <= AI_GATEWAY.catalogMaxPages; page++) {
		const url = new URL(`${base}/ai/catalog/models`);
		url.searchParams.set("task", "Text Generation");
		url.searchParams.set("per_page", String(AI_GATEWAY.catalogPageSize));
		url.searchParams.set("page", String(page));
		let response: Response;
		try {
			response = await request(url, {
				headers: {
					authorization: `Bearer ${apiToken}`,
					accept: "application/json",
				},
				signal: AbortSignal.timeout(AI_GATEWAY.catalogTimeoutMs),
				redirect: "error",
			});
		} catch {
			throw new GatewayCatalogError(0);
		}
		if (!response.ok) throw new GatewayCatalogError(response.status);
		const parsed = catalogPage.safeParse(
			await response.json().catch(() => null),
		);
		if (!parsed.success) throw new GatewayCatalogError(0);
		for (const entry of parsed.data.result) {
			const model = parseCatalogModel(entry);
			if (model) models.set(model.id, model);
		}
		seen += parsed.data.result.length;
		if (seen >= parsed.data.result_info.total_count) {
			return [...models.values()].sort(
				(a, b) =>
					a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name),
			);
		}
		if (!parsed.data.result.length) throw new GatewayCatalogError(0);
	}
	throw new GatewayCatalogError(0);
}
