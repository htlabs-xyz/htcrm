import { db } from "@crm/db";
import { AI_PROVIDER } from "@crm/db/ai-provider-config";
import { defineAgent, defineDynamic } from "eve";
import { z } from "zod";
import { unavailableModel } from "../../lib/openai-compatible-model";
import { providerSessionModel } from "../../lib/provider-session-model";
import { attribute, purposeOf } from "../../lib/session-purpose";

export default defineAgent({
	modelContextWindowTokens: AI_PROVIDER.unconfiguredContextTokens,
	description:
		"Execute one immutable deployed CRM agent version and persist its result and every side effect.",
	model: defineDynamic({
		fallback: unavailableModel(),
		events: {
			"step.started": async (_event, ctx) =>
				providerSessionModel(async () => {
					if (purposeOf(ctx) !== "team-agent") return null;
					const runId = attribute(ctx, "runId");
					if (!runId) return null;

					const run = await db.agentRun.findUnique({
						where: { id: runId },
						select: {
							version: {
								select: {
									modelId: true,
									modelContextWindowTokens: true,
									modelProviderId: true,
									modelMaxOutputTokens: true,
								},
							},
						},
					});
					return run?.version.modelProviderId &&
						run.version.modelMaxOutputTokens
						? {
								modelId: run.version.modelId,
								providerId: run.version.modelProviderId,
								maxOutputTokens: run.version.modelMaxOutputTokens,
								contextWindowTokens: run.version.modelContextWindowTokens,
							}
						: null;
				}),
		},
	}),
	outputSchema: z.object({
		summary: z.string().min(1).max(1000),
		result: z.record(z.string(), z.unknown()).nullable(),
	}),
	limits: {
		maxInputTokensPerSession: 500_000,
		maxOutputTokensPerSession: 40_000,
		sessionTimeoutMs: 24 * 60 * 60 * 1000,
	},
});
