import { AI_PROVIDER } from "@crm/db/ai-provider-config";
import type { AiProviderInput } from "@crm/validation/ai-provider";
import { streamText, tool } from "ai";
import { z } from "zod";
import { openAICompatibleModel } from "./openai-compatible-model";

export async function verifyAiProvider(
	input: AiProviderInput & { apiKey: string },
	model = openAICompatibleModel(input),
) {
	try {
		const signal = AbortSignal.timeout(AI_PROVIDER.verifyTimeoutMs);
		const first = streamText({
			model,
			abortSignal: signal,
			maxRetries: 0,
			maxOutputTokens: Math.min(
				input.maxOutputTokens,
				AI_PROVIDER.verifyOutputTokens,
			),
			prompt:
				"Call crm_connection_check with value ping. This is a harmless connection test.",
			toolChoice: { type: "tool", toolName: "crm_connection_check" },
			tools: {
				crm_connection_check: tool({
					description:
						"Check the AI connection without reading or changing CRM data.",
					inputSchema: z.object({ value: z.literal("ping") }),
					execute: async () => "pong",
				}),
			},
		});
		await first.consumeStream({
			onError: (error) => {
				throw error;
			},
		});
		const calls = await first.toolCalls;
		const results = await first.toolResults;
		if (
			calls.length !== 1 ||
			calls[0]?.toolName !== "crm_connection_check" ||
			results.length !== 1
		)
			return {
				ok: false,
				message:
					"This model did not complete the CRM tool check. Choose a model that supports tool calling.",
			};
		const second = streamText({
			model,
			abortSignal: signal,
			maxRetries: 0,
			maxOutputTokens: Math.min(
				input.maxOutputTokens,
				AI_PROVIDER.verifyOutputTokens,
			),
			messages: [
				{
					role: "user",
					content:
						"Call crm_connection_check with value ping. Then confirm the result briefly.",
				},
				...(await first.response).messages,
			],
		});
		await second.consumeStream({
			onError: (error) => {
				throw error;
			},
		});
		if (!(await second.text).trim())
			return {
				ok: false,
				message: "The model called the tool but did not return a final answer.",
			};
		return { ok: true, message: "Streaming and CRM tool calling work." };
	} catch {
		return {
			ok: false,
			message:
				"The model check failed. Check the endpoint, API key, balance, and support for streaming tool calls.",
		};
	}
}
