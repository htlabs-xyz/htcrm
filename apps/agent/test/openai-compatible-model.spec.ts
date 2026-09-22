import { describe, expect, it } from "bun:test";
import type { providerRequest } from "@crm/db/ai-provider-http";
import { generateText } from "ai";
import { openAICompatibleModel } from "../agent/lib/openai-compatible-model";
import { verifyAiProvider } from "../agent/lib/verify-ai-provider";

const config = {
	baseUrl: "https://api.example.com/custom/v1",
	apiKey: "local-test-key",
	modelId: "provider/custom-model",
	maxOutputTokens: 1000,
};
const completion = () =>
	Response.json({
		id: "chat-test",
		object: "chat.completion",
		created: 1,
		model: config.modelId,
		choices: [
			{
				index: 0,
				message: { role: "assistant", content: "OK" },
				finish_reason: "stop",
			},
		],
		usage: { prompt_tokens: 10, completion_tokens: 1, total_tokens: 11 },
	});
type ChatDelta = {
	role?: "assistant";
	content?: string;
	reasoning_content?: string;
	tool_calls?: {
		index: number;
		id: string;
		type: "function";
		function: { name: string; arguments: string };
	}[];
};
function stream(delta: ChatDelta, finishReason: string) {
	const chunk = (body: ChatDelta, finish: string | null) => ({
		id: "chat-test",
		object: "chat.completion.chunk",
		created: 1,
		model: config.modelId,
		choices: [{ index: 0, delta: body, finish_reason: finish }],
	});
	return new Response(
		`data: ${JSON.stringify(chunk(delta, null))}\n\ndata: ${JSON.stringify(chunk({}, finishReason))}\n\ndata: [DONE]\n\n`,
		{ headers: { "content-type": "text/event-stream" } },
	);
}

describe("direct OpenAI-compatible model", () => {
	it("uses the configured base, exact upstream model, key, and output budget", async () => {
		let requestBody = "";
		const request: typeof providerRequest = async (base, key, path, init) => {
			expect(base).toBe(config.baseUrl);
			expect(key).toBe(config.apiKey);
			expect(path).toBe("chat/completions");
			requestBody = init?.body ?? "";
			return completion();
		};
		expect(
			(
				await generateText({
					model: openAICompatibleModel(config, request),
					prompt: "Check",
					maxOutputTokens: 5000,
				})
			).text,
		).toBe("OK");
		const body = JSON.parse(requestBody);
		expect(body.model).toBe(config.modelId);
		expect(body.max_tokens).toBe(1000);
		expect(requestBody).not.toContain(config.apiKey);
	});
	it("verifies streaming tool calls and the subsequent tool-result turn", async () => {
		let count = 0;
		const request: typeof providerRequest = async (
			_base,
			_key,
			_path,
			init,
		) => {
			count += 1;
			const body = JSON.parse(init?.body ?? "{}");
			expect(body.stream).toBe(true);
			if (count === 1) {
				expect(body.tool_choice.function.name).toBe("crm_connection_check");
				return stream(
					{
						role: "assistant",
						tool_calls: [
							{
								index: 0,
								id: "call-test",
								type: "function",
								function: {
									name: "crm_connection_check",
									arguments: '{"value":"ping"}',
								},
							},
						],
					},
					"tool_calls",
				);
			}
			expect(
				body.messages.some(
					(message: { role: string; content?: string }) =>
						message.role === "tool" && message.content?.includes("pong"),
				),
			).toBe(true);
			return stream(
				{ role: "assistant", content: "Connection works." },
				"stop",
			);
		};
		const result = await verifyAiProvider(
			{ ...config, revision: null, contextWindowTokens: 32000 },
			openAICompatibleModel(config, request),
		);
		expect(result.ok).toBe(true);
		expect(count).toBe(2);
	});
	it("does not mark plain chat responses as compatible tool support", async () => {
		const request: typeof providerRequest = async () =>
			stream({ role: "assistant", content: "Hello" }, "stop");
		expect(
			(
				await verifyAiProvider(
					{ ...config, revision: null, contextWindowTokens: 32000 },
					openAICompatibleModel(config, request),
				)
			).ok,
		).toBe(false);
	});
	it("redacts provider error bodies", async () => {
		const request: typeof providerRequest = async () =>
			Response.json(
				{ error: { message: `secret ${config.apiKey}` } },
				{ status: 401 },
			);
		const result = generateText({
			model: openAICompatibleModel(config, request),
			prompt: "Check",
			maxRetries: 0,
		});
		await expect(result).rejects.toThrow("refused access");
		try {
			await result;
		} catch (error) {
			expect(String(error)).not.toContain(config.apiKey);
		}
	});
});
