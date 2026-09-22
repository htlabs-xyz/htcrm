import { AI_PROVIDER } from "@crm/db/ai-provider-config";
import "@crm/env/load";

import { onTelemetryProblem, syncVersion } from "@crm/telemetry";
import { defineAgent, defineDynamic } from "eve";
import { logCapabilities } from "./lib/capabilities";
import { unavailableModel } from "./lib/openai-compatible-model";
import { providerSessionModel } from "./lib/provider-session-model";

void logCapabilities();

onTelemetryProblem((message) => console.debug(`[telemetry] ${message}`));

void syncVersion();

export default defineAgent({
	modelContextWindowTokens: AI_PROVIDER.unconfiguredContextTokens,
	model: defineDynamic({
		fallback: unavailableModel(),
		events: { "step.started": () => providerSessionModel() },
	}),
	limits: {
		maxInputTokensPerSession: 500_000,
		maxOutputTokensPerSession: 50_000,
		sessionTimeoutMs: 30 * 24 * 60 * 60 * 1000,
	},
});
