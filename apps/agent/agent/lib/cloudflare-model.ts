import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import type { GatewayModel } from "@crm/ai-gateway";
import { gatewayAccountUrl } from "@crm/ai-gateway/config";
import { wrapLanguageModel } from "ai";

export function unavailableModel(
	message = "Enter a Cloudflare key and choose a model in Settings to enable AI.",
): LanguageModelV4 {
	return {
		specificationVersion: "v4",
		provider: "cloudflare",
		modelId: "unconfigured",
		supportedUrls: {},
		doGenerate: async () => {
			throw new Error(message);
		},
		doStream: async () => {
			throw new Error(message);
		},
	};
}

export function cloudflareModel(
	model: Pick<GatewayModel, "id" | "requestFormat"> &
		Partial<Pick<GatewayModel, "maxOutputTokens">>,
	accountId: string,
	apiToken: string,
	request: typeof fetch = fetch,
): LanguageModelV4 {
	const baseURL = `${gatewayAccountUrl(accountId)}/ai/v1`;
	const headers = { "cf-aig-skip-cache": "true" };
	const guardedFetch: typeof fetch = async (input, init) => {
		const response = await request(input, { ...init, redirect: "error" });
		if (!response.ok) {
			await response.body?.cancel();
			const message =
				response.status === 401 || response.status === 403
					? "Cloudflare refused the key. Replace it in Settings with a token that has Workers AI Read."
					: response.status === 402
						? "Cloudflare AI credits are unavailable. Check Unified Billing in Cloudflare."
						: `Cloudflare could not run the selected model (HTTP ${response.status}). Check the model and account in Cloudflare.`;
			return Response.json(
				{ error: { message, type: "cloudflare_gateway_error" } },
				{ status: response.status },
			);
		}
		return response;
	};
	const providerModel =
		model.requestFormat === "anthropic-messages"
			? createAnthropic({
					baseURL,
					authToken: apiToken,
					headers,
					fetch: guardedFetch,
				})(model.id)
			: model.requestFormat === "responses"
				? createOpenAI({
						baseURL,
						apiKey: apiToken,
						headers,
						fetch: guardedFetch,
					}).responses(model.id)
				: createOpenAICompatible({
						name: "cloudflare",
						baseURL,
						apiKey: apiToken,
						headers,
						fetch: guardedFetch,
					}).chatModel(model.id);
	return wrapLanguageModel({
		model: providerModel,
		middleware: {
			specificationVersion: "v4",
			transformParams: async ({ params }) => ({
				...params,
				maxOutputTokens: model.maxOutputTokens
					? Math.min(
							params.maxOutputTokens ?? model.maxOutputTokens,
							model.maxOutputTokens,
						)
					: params.maxOutputTokens,
				providerOptions:
					model.requestFormat === "responses"
						? {
								...params.providerOptions,
								openai: { ...params.providerOptions?.openai, store: false },
							}
						: params.providerOptions,
			}),
		},
	});
}
