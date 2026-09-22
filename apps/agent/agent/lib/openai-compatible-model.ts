import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import {
	providerBaseUrl,
	providerError,
	providerRequest,
} from "@crm/db/ai-provider-http";
import { APICallError, wrapLanguageModel } from "ai";
import { z } from "zod";

const providerFailure = z
	.custom<APICallError>(APICallError.isInstance)
	.nullable()
	.catch(null);
const modelRequestBody = z.string();

export function unavailableModel(
	message = "Configure an OpenAI-compatible endpoint, API key, and model in Settings.",
): LanguageModelV4 {
	return {
		specificationVersion: "v4",
		provider: "openai-compatible",
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

function safeModelError(error: APICallError | null): Error {
	return new Error(
		error?.statusCode
			? providerError(error.statusCode)
			: "The AI provider returned an invalid response or the request was interrupted. Check the endpoint and model.",
	);
}

export function openAICompatibleModel(
	config: {
		baseUrl: string;
		apiKey: string;
		modelId: string;
		maxOutputTokens: number;
	},
	request = providerRequest,
): LanguageModelV4 {
	const baseURL = providerBaseUrl(config.baseUrl);
	const model = createOpenAICompatible({
		name: "openai-compatible",
		baseURL,
		apiKey: config.apiKey,
		includeUsage: true,
		fetch: async (input, init) => {
			const url = input instanceof Request ? input.url : String(input);
			const body = modelRequestBody.safeParse(init?.body);
			if (url !== `${baseURL}/chat/completions` || !body.success)
				throw new Error(
					"The AI request does not match the configured endpoint.",
				);
			return request(baseURL, config.apiKey, "chat/completions", {
				body: body.data,
				signal: init?.signal,
			});
		},
	}).chatModel(config.modelId);
	return wrapLanguageModel({
		model,
		middleware: {
			specificationVersion: "v4",
			transformParams: async ({ params }) => ({
				...params,
				maxOutputTokens: Math.min(
					params.maxOutputTokens ?? config.maxOutputTokens,
					config.maxOutputTokens,
				),
			}),
			wrapGenerate: async ({ doGenerate }) => {
				try {
					return await doGenerate();
				} catch (error) {
					throw safeModelError(providerFailure.parse(error));
				}
			},
			wrapStream: async ({ doStream }) => {
				try {
					const result = await doStream();
					return {
						...result,
						stream: result.stream.pipeThrough(
							new TransformStream({
								transform(chunk, controller) {
									controller.enqueue(
										chunk.type === "error"
											? {
													...chunk,
													error: safeModelError(
														providerFailure.parse(chunk.error),
													),
												}
											: chunk,
									);
								},
							}),
						),
					};
				} catch (error) {
					throw safeModelError(providerFailure.parse(error));
				}
			},
		},
	});
}
