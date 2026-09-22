import {
	fetchGatewayCatalog,
	GatewayCatalogError,
	type GatewayModel,
} from "@crm/ai-gateway";
import { gatewayAccountId, gatewayId } from "@crm/ai-gateway/config";
import { db } from "@crm/db";
import { readGatewayKey } from "@crm/db/ai-gateway-key";
import { defineState } from "eve/context";
import { cloudflareModel, unavailableModel } from "./cloudflare-model";
import { type ModelSelection, selectedModel } from "./model";

const sessionModel = defineState<GatewayModel | null>(
	"crm.cloudflare-model",
	() => null,
);

export async function cloudflareSessionModel(
	loadSelection: () => Promise<ModelSelection | null> = selectedModel,
	state: Pick<typeof sessionModel, "get" | "update"> = sessionModel,
) {
	try {
		const accountId = gatewayAccountId();
		if (!accountId || !gatewayId())
			return {
				model: unavailableModel(
					"Configure CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_GATEWAY_ID on the CRM server to enable AI.",
				),
			};
		const apiToken = await readGatewayKey(db);
		if (!apiToken) return { model: unavailableModel() };
		let model = state.get();
		if (!model) {
			const selection = await loadSelection();
			if (!selection) return { model: unavailableModel() };
			const catalog = await fetchGatewayCatalog(accountId, apiToken);
			model = catalog.find((entry) => entry.id === selection.model) ?? null;
			if (!model)
				return {
					model: unavailableModel(
						"The saved model is unavailable on Cloudflare. Choose a model in Settings; rebuild deployed agents that use the old model.",
					),
				};
			model = {
				...model,
				contextWindowTokens: Math.min(
					model.contextWindowTokens,
					selection.modelContextWindowTokens,
				),
			};
			state.update(() => model);
		}
		return {
			model: cloudflareModel(model, accountId, apiToken),
			modelContextWindowTokens: model.contextWindowTokens,
		};
	} catch (error) {
		return {
			model: unavailableModel(
				error instanceof GatewayCatalogError
					? error.message
					: "Could not load AI setup. Re-enter the Cloudflare key and choose a model in Settings.",
			),
		};
	}
}
