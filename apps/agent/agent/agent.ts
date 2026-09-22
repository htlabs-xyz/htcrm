import "@crm/env/load";

import { DEFAULT_AGENT_MODEL } from "@crm/db/settings";
import { onTelemetryProblem, syncVersion } from "@crm/telemetry";
import { defineAgent, defineDynamic } from "eve";
import { logCapabilities } from "./lib/capabilities";
import { unavailableModel } from "./lib/cloudflare-model";
import { cloudflareSessionModel } from "./lib/cloudflare-session-model";

void logCapabilities();

onTelemetryProblem((message) => console.debug(`[telemetry] ${message}`));

void syncVersion();

export default defineAgent({
	modelContextWindowTokens: DEFAULT_AGENT_MODEL.contextWindowTokens,
	model: defineDynamic({
		fallback: unavailableModel(),
		events: { "step.started": () => cloudflareSessionModel() },
	}),
	limits: {
		maxInputTokensPerSession: 500_000,
		maxOutputTokensPerSession: 50_000,
		sessionTimeoutMs: 30 * 24 * 60 * 60 * 1000,
	},
});
