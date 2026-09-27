import {
	aiProviderConnectionInput,
	aiProviderInput,
} from "@crm/validation/ai-provider";
import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import { AiProviderService } from "./ai-provider.service";
import {
	agentModelOutput,
	aiProviderOutput,
	archiveRetentionOutput,
	modelCatalogOutput,
	removeAiProviderInput,
	researchKeyOutput,
	setAgentModelInput,
	setArchiveRetentionDaysInput,
	setResearchKeyInput,
} from "./settings.contracts";
import { SettingsService } from "./settings.service";

@Router({ alias: "settings" })
@UseMiddlewares(AuthMiddleware)
export class SettingsRouter {
	constructor(
		@Inject(SettingsService) private readonly settings: SettingsService,
		@Inject(AiProviderService) private readonly provider: AiProviderService,
	) {}

	@Query({
		output: aiProviderOutput,
		meta: restMeta("GET", "/settings/ai-provider", ["Settings"]),
	})
	async aiProvider() {
		return this.provider.settings();
	}

	@Mutation({
		input: aiProviderInput,
		output: aiProviderOutput,
		meta: restMeta("PATCH", "/settings/ai-provider", ["Settings"]),
	})
	async setAiProvider(@Input() input: z.infer<typeof aiProviderInput>) {
		return this.provider.save(input);
	}

	@Mutation({
		input: aiProviderConnectionInput,
		output: modelCatalogOutput,
		meta: restMeta("POST", "/settings/ai-provider/models", ["Settings"]),
	})
	async providerModels(
		@Input() input: z.infer<typeof aiProviderConnectionInput>,
	) {
		return this.provider.models(input);
	}

	@Mutation({
		input: removeAiProviderInput,
		output: aiProviderOutput,
		meta: restMeta("POST", "/settings/ai-provider/remove", ["Settings"]),
	})
	async removeAiProvider(
		@Input() input: z.infer<typeof removeAiProviderInput>,
	) {
		return this.provider.remove(input.revision);
	}

	@Query({
		output: agentModelOutput,
		meta: restMeta("GET", "/settings/agent-model", ["Settings"]),
	})
	async agentModel() {
		return this.settings.agentModel();
	}

	@Query({
		output: modelCatalogOutput,
		meta: restMeta("GET", "/settings/model-catalog", ["Settings"]),
	})
	async modelCatalog() {
		return this.settings.modelCatalog();
	}

	@Mutation({
		input: setAgentModelInput,
		output: agentModelOutput,
		meta: restMeta("PATCH", "/settings/agent-model", ["Settings"]),
	})
	async setAgentModel(@Input() input: z.infer<typeof setAgentModelInput>) {
		return this.settings.setAgentModel(input.modelId);
	}

	@Query({
		output: researchKeyOutput,
		meta: restMeta("GET", "/settings/research-key", ["Settings"]),
	})
	async researchKey() {
		return this.settings.researchKey();
	}

	@Mutation({
		input: setResearchKeyInput,
		output: researchKeyOutput,
		meta: restMeta("PATCH", "/settings/research-key", ["Settings"]),
	})
	async setResearchKey(@Input() input: z.infer<typeof setResearchKeyInput>) {
		return this.settings.setResearchKey(input.apiKey);
	}

	@Query({
		output: archiveRetentionOutput,
		meta: restMeta("GET", "/settings/archive-retention", ["Settings"]),
	})
	async archiveRetention() {
		return this.settings.archiveRetention();
	}

	@Mutation({
		input: setArchiveRetentionDaysInput,
		output: archiveRetentionOutput,
		meta: restMeta("PATCH", "/settings/archive-retention", ["Settings"]),
	})
	async setArchiveRetention(
		@Input() input: z.infer<typeof setArchiveRetentionDaysInput>,
	) {
		return this.settings.setArchiveRetention(input.days);
	}
}
