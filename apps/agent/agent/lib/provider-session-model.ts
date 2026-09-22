import { db } from "@crm/db";
import { decryptProviderKey, readAiProvider } from "@crm/db/ai-provider";
import { AI_PROVIDER } from "@crm/db/ai-provider-config";
import { defineState } from "eve/context";
import {
	openAICompatibleModel,
	unavailableModel,
} from "./openai-compatible-model";

export interface ProviderModelSelection {
	modelId: string;
	providerId: string;
	contextWindowTokens: number;
	maxOutputTokens: number;
}

const sessionModel = defineState<ProviderModelSelection | null>(
	"crm.openai-compatible-model",
	() => null,
);

export function pinnedProviderModelId(): string | null {
	return sessionModel.get()?.modelId ?? null;
}

export async function providerSessionModel(
	loadSelection?: () => Promise<ProviderModelSelection | null>,
	state: Pick<typeof sessionModel, "get" | "update"> = sessionModel,
) {
	try {
		const row = await readAiProvider(db);
		if (!row?.aiProviderId || !row.aiProviderBaseUrl || !row.aiProviderApiKey)
			return {
				model: unavailableModel(),
				modelContextWindowTokens: AI_PROVIDER.unconfiguredContextTokens,
			};
		let selected = state.get();
		if (!selected) {
			selected = loadSelection
				? await loadSelection()
				: row.agentModelId &&
						row.agentModelContextWindow &&
						row.agentModelMaxOutputTokens
					? {
							modelId: row.agentModelId,
							providerId: row.aiProviderId,
							contextWindowTokens: row.agentModelContextWindow,
							maxOutputTokens: row.agentModelMaxOutputTokens,
						}
					: null;
			if (!selected)
				return {
					model: unavailableModel(
						"This agent has no compatible provider configuration. Choose a model and rebuild the agent in Settings.",
					),
					modelContextWindowTokens: AI_PROVIDER.unconfiguredContextTokens,
				};
			state.update(() => selected);
		}
		if (selected.providerId !== row.aiProviderId)
			return {
				model: unavailableModel(
					"The AI endpoint changed. Start a new session or rebuild this deployed agent.",
				),
				modelContextWindowTokens: selected.contextWindowTokens,
			};
		return {
			model: openAICompatibleModel({
				baseUrl: row.aiProviderBaseUrl,
				apiKey: decryptProviderKey(row.aiProviderApiKey, row.aiProviderId),
				modelId: selected.modelId,
				maxOutputTokens: selected.maxOutputTokens,
			}),
			modelContextWindowTokens: selected.contextWindowTokens,
		};
	} catch {
		return {
			model: unavailableModel(
				"Could not load AI settings. Check the saved endpoint and enter the API key again.",
			),
			modelContextWindowTokens: AI_PROVIDER.unconfiguredContextTokens,
		};
	}
}
