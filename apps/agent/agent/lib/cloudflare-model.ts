import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import type { GatewayModel } from "@crm/ai-gateway";
import {
	gatewayAccountUrl,
	gatewayBaseUrl,
	gatewayId,
} from "@crm/ai-gateway/config";
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
	gatewayName = gatewayId(),
): LanguageModelV4 {
	const nativeBase = gatewayBaseUrl(accountId, gatewayName);
	const deepseek = model.id.startsWith("deepseek/");
	const modelId = deepseek ? model.id.slice("deepseek/".length) : model.id;
	const baseURL = deepseek
		? `${nativeBase}/deepseek`
		: `${gatewayAccountUrl(accountId)}/ai/v1`;
	const guardedFetch: typeof fetch = async (input, init) => {
		const headers = new Headers(init?.headers);
		headers.set("cf-aig-skip-cache", "true");
		headers.set("cf-aig-no-wholesale", "true");
		if (deepseek) {
			headers.delete("authorization");
			headers.delete("x-api-key");
			headers.set("cf-aig-authorization", `Bearer ${apiToken}`);
		} else {
			headers.set("cf-aig-gateway-id", gatewayName ?? "");
		}
		const response = await request(input, {
			...init,
			headers,
			redirect: "error",
		});
		if (!response.ok) {
			await response.body?.cancel();
			const message =
				response.status === 401 || response.status === 403
					? "Cloudflare refused the key. Check AI Gateway Read and Run, Workers AI Read, and the stored provider key."
					: response.status === 402
						? "AI provider credits are unavailable. Check the balance for your BYOK provider key."
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
					fetch: guardedFetch,
				})(modelId)
			: model.requestFormat === "responses"
				? createOpenAI({
						baseURL,
						apiKey: apiToken,
						fetch: guardedFetch,
					}).responses(modelId)
				: createOpenAICompatible({
						name: "cloudflare",
						baseURL,
						apiKey: apiToken,
						fetch: guardedFetch,
					}).chatModel(modelId);
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
