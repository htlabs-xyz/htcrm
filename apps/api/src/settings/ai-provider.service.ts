import type { Db } from "@crm/db";
import {
	aiProviderModel,
	decryptProviderKey,
	readAiProvider,
	writeAiProvider,
} from "@crm/db/ai-provider";
import { AI_PROVIDER } from "@crm/db/ai-provider-config";
import { providerBaseUrl } from "@crm/db/ai-provider-http";
import {
	type AiProviderConnectionInput,
	type AiProviderInput,
	aiProviderVerification,
} from "@crm/validation/ai-provider";
import { BadRequestException, Injectable } from "@nestjs/common";
import { bridge } from "../agent/bridge";
import { InjectDatabase } from "../database/database.constants";
import { ModelCatalogService } from "./model-catalog.service";

@Injectable()
export class AiProviderService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly catalog: ModelCatalogService,
	) {}

	async settings() {
		const row = await readAiProvider(this.db);
		let needsReplacement = false;
		if (row?.aiProviderId && row.aiProviderApiKey) {
			try {
				decryptProviderKey(row.aiProviderApiKey, row.aiProviderId);
			} catch {
				needsReplacement = true;
			}
		}
		return {
			configured: Boolean(aiProviderModel(row) && !needsReplacement),
			baseUrl: row?.aiProviderBaseUrl ?? "",
			revision: row?.aiProviderRevision ?? null,
			modelId: row?.aiProviderId ? row.agentModelId : null,
			contextWindowTokens: row?.aiProviderId
				? row.agentModelContextWindow
				: null,
			maxOutputTokens: row?.aiProviderId ? row.agentModelMaxOutputTokens : null,
			needsReplacement,
		};
	}

	async candidate(input: AiProviderConnectionInput) {
		try {
			const baseUrl = providerBaseUrl(input.baseUrl);
			const row = await readAiProvider(this.db);
			if ((row?.aiProviderRevision ?? null) !== input.revision)
				throw new Error(
					"AI settings changed. Reload Settings before saving again.",
				);
			let apiKey = input.apiKey;
			if (
				!apiKey &&
				row?.aiProviderBaseUrl === baseUrl &&
				row.aiProviderApiKey &&
				row.aiProviderId
			)
				apiKey = decryptProviderKey(row.aiProviderApiKey, row.aiProviderId);
			if (!apiKey)
				throw new Error(
					"Enter the API key for this endpoint. Changing the endpoint requires its key.",
				);
			return { baseUrl, apiKey };
		} catch (error) {
			throw new BadRequestException(
				error instanceof Error
					? error.message
					: "Invalid AI provider configuration.",
			);
		}
	}

	async models(input: AiProviderConnectionInput) {
		return this.catalog.load(await this.candidate(input));
	}

	async save(input: AiProviderInput) {
		const candidate = { ...input, ...(await this.candidate(input)) };
		const result = await this.verify(candidate);
		if (!result.ok) throw new BadRequestException(result.message);
		try {
			await writeAiProvider(this.db, candidate, input.revision);
		} catch {
			throw new BadRequestException(
				"AI settings changed or the key could not be saved. Reload Settings and try again.",
			);
		}
		return this.settings();
	}

	async remove(revision: string | null) {
		try {
			await writeAiProvider(this.db, null, revision);
		} catch {
			throw new BadRequestException(
				"AI settings changed. Reload Settings before removing the provider.",
			);
		}
		return this.settings();
	}

	async verify(input: AiProviderInput & { apiKey: string }) {
		const agent = bridge();
		if (!agent)
			return {
				ok: false,
				message: "Configure the agent bridge before checking an AI model.",
			};
		try {
			const response = await fetch(
				agent.url("/internal/crm/verify-ai-provider"),
				{
					method: "POST",
					redirect: "error",
					headers: {
						authorization: `Bearer ${agent.secret}`,
						"content-type": "application/json",
					},
					body: JSON.stringify(input),
					signal: AbortSignal.timeout(AI_PROVIDER.bridgeTimeoutMs),
				},
			);
			if (!response.ok)
				return {
					ok: false,
					message:
						"The agent could not check this model. Check the agent bridge and try again.",
				};
			return aiProviderVerification.parse(await response.json());
		} catch {
			return {
				ok: false,
				message:
					"The agent model check timed out or failed. The saved AI configuration has not changed.",
			};
		}
	}
}
