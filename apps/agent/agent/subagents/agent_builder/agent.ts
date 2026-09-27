import { AI_PROVIDER } from "@crm/db/ai-provider-config";
import { defineAgent, defineDynamic } from "eve";
import { z } from "zod";
import { unavailableModel } from "../../lib/openai-compatible-model";
import { providerSessionModel } from "../../lib/provider-session-model";

export default defineAgent({
	modelContextWindowTokens: AI_PROVIDER.unconfiguredContextTokens,
	description:
		"Turn one private CRM builder-chat request into a validated, reviewable team-agent version without deploying it.",
	model: defineDynamic({
		fallback: unavailableModel(),
		events: { "step.started": () => providerSessionModel() },
	}),
	outputSchema: z.object({
		status: z.literal("draft_ready"),
		summary: z.string().min(1).max(1000),
		agentId: z.string().min(1),
		versionId: z.string().min(1),
	}),
	limits: {
		maxInputTokensPerSession: 100_000,
		maxOutputTokensPerSession: 10_000,
		sessionTimeoutMs: 24 * 60 * 60 * 1000,
	},
});
