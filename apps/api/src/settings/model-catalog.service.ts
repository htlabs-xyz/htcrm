import type { Db } from "@crm/db";
import { decryptProviderKey, readAiProvider } from "@crm/db/ai-provider";
import { AI_PROVIDER } from "@crm/db/ai-provider-config";
import {
	providerError,
	providerJson,
	providerRequest,
} from "@crm/db/ai-provider-http";
import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { InjectDatabase } from "../database/database.constants";
import type { CatalogModel, ModelCatalogResult } from "./settings.contracts";

const positiveTokens = z
	.number()
	.int()
	.positive()
	.max(AI_PROVIDER.maxContextTokens)
	.nullable()
	.catch(null);
const modelEntry = z.object({
	id: z.string().min(1).max(200),
	name: z.string().catch(""),
	owned_by: z.string().catch(""),
	context_window: positiveTokens,
	context_length: positiveTokens,
	max_output_tokens: positiveTokens,
});
const providerCatalog = z
	.object({
		data: z.array(z.unknown()).max(AI_PROVIDER.maxCatalogModels),
	})
	.transform(({ data }) => {
		const models = new Map<string, CatalogModel>();
		for (const entry of data) {
			const result = modelEntry.safeParse(entry);
			if (!result.success) continue;
			const model = result.data;
			models.set(model.id, {
				id: model.id,
				name: model.name || model.id,
				provider: model.owned_by || "OpenAI-compatible",
				contextWindowTokens: model.context_window ?? model.context_length,
				maxOutputTokens: model.max_output_tokens,
				pricing: null,
			});
		}
		return [...models.values()].sort((a, b) => a.name.localeCompare(b.name));
	});

export const parseProviderCatalog = providerCatalog.parse;

@Injectable()
export class ModelCatalogService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async load(connection: {
		baseUrl: string;
		apiKey: string;
	}): Promise<ModelCatalogResult> {
		try {
			const response = await providerRequest(
				connection.baseUrl,
				connection.apiKey,
				"models",
				{ timeoutMs: AI_PROVIDER.catalogTimeoutMs },
			);
			if (!response.ok)
				return {
					models: [],
					available: false,
					message: `${providerError(response.status)} You can enter a model ID manually.`,
				};
			return {
				models: parseProviderCatalog(await providerJson(response)),
				available: true,
				message: null,
			};
		} catch {
			return {
				models: [],
				available: false,
				message:
					"The model list is unavailable. Enter a model ID and its token limits manually.",
			};
		}
	}

	async models(): Promise<CatalogModel[] | null> {
		try {
			const row = await readAiProvider(this.db);
			if (!row?.aiProviderId || !row.aiProviderBaseUrl || !row.aiProviderApiKey)
				return null;
			const result = await this.load({
				baseUrl: row.aiProviderBaseUrl,
				apiKey: decryptProviderKey(row.aiProviderApiKey, row.aiProviderId),
			});
			return result.available ? result.models : null;
		} catch {
			return null;
		}
	}

	async find(id: string): Promise<CatalogModel | null> {
		return (await this.models())?.find((model) => model.id === id) ?? null;
	}
}
