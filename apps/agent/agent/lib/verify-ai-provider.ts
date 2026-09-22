import { AI_PROVIDER } from "@crm/db/ai-provider-config";
import type { AiProviderInput } from "@crm/validation/ai-provider";
import { streamText, tool } from "ai";
import { z } from "zod";
import {
	AiProviderModelError,
	openAICompatibleModel,
} from "./openai-compatible-model";

export async function verifyAiProvider(
	input: AiProviderInput & { apiKey: string },
	model = openAICompatibleModel(input),
) {
	const signal = AbortSignal.timeout(AI_PROVIDER.verifyTimeoutMs);
	const maxOutputTokens = Math.min(
		input.maxOutputTokens,
		AI_PROVIDER.verifyOutputTokens,
	);
	const tokenLimitResult = {
		ok: false,
		message: `The model reached the connection test token limit (${maxOutputTokens}). Use a model with shorter reasoning, or increase the response budget up to the test maximum of ${AI_PROVIDER.verifyOutputTokens} tokens.`,
	};
	const prompt =
		"Call crm_connection_check exactly once with value ping. After receiving pong, confirm the result briefly without calling another tool. This is a harmless connection test.";
	const tools = {
		crm_connection_check: tool({
			description:
				"Check the AI connection without reading or changing CRM data.",
			inputSchema: z.object({ value: z.literal("ping") }),
			execute: async () => "pong",
		}),
	};
	try {
		const first = streamText({
			model,
			abortSignal: signal,
			maxRetries: 0,
			maxOutputTokens,
			prompt,
			toolChoice: "auto",
			tools,
			onError: ({ error }) => {
				throw error;
			},
		});
		await first.consumeStream({
			onError: (error) => {
				throw error;
			},
		});
		if ((await first.finishReason) === "length") return tokenLimitResult;
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
			maxOutputTokens,
			toolChoice: "auto",
			tools,
			onError: ({ error }) => {
				throw error;
			},
			messages: [
				{
					role: "user",
					content: prompt,
				},
				...(await first.response).messages,
			],
		});
		await second.consumeStream({
			onError: (error) => {
				throw error;
			},
		});
		if ((await second.finishReason) === "length") return tokenLimitResult;
		if (
			(await second.finishReason) !== "stop" ||
			(await second.toolCalls).length > 0 ||
			!(await second.text).trim()
		)
			return {
				ok: false,
				message: "The model called the tool but did not return a final answer.",
			};
		return { ok: true, message: "Streaming and CRM tool calling work." };
	} catch (error) {
		return {
			ok: false,
			message: signal.aborted
				? "The model check timed out. Retry or choose a faster model."
				: error instanceof AiProviderModelError
					? error.message
					: "The model check failed while processing the streaming tool response. Check the endpoint and model support for streaming tool calls.",
		};
	}
}
