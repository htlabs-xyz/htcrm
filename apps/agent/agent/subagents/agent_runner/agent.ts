import { db } from "@crm/db";
import { DEFAULT_AGENT_MODEL } from "@crm/db/settings";
import { defineAgent, defineDynamic } from "eve";
import { z } from "zod";
import { unavailableModel } from "../../lib/cloudflare-model";
import { cloudflareSessionModel } from "../../lib/cloudflare-session-model";
import { attribute, purposeOf } from "../../lib/session-purpose";

export default defineAgent({
	modelContextWindowTokens: DEFAULT_AGENT_MODEL.contextWindowTokens,
	description:
		"Execute one immutable deployed CRM agent version and persist its result and every side effect.",
	model: defineDynamic({
		fallback: unavailableModel(),
		events: {
			"step.started": (_event, ctx) =>
				cloudflareSessionModel(async () => {
					if (purposeOf(ctx) !== "team-agent") return null;
					const runId = attribute(ctx, "runId");
					if (!runId) return null;

					const run = await db.agentRun.findUnique({
						where: { id: runId },
						select: {
							version: {
								select: { modelId: true, modelContextWindowTokens: true },
							},
						},
					});
					return run
						? {
								model: run.version.modelId,
								modelContextWindowTokens: run.version.modelContextWindowTokens,
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
