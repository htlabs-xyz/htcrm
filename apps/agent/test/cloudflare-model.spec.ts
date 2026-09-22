import { describe, expect, it } from "bun:test";
import type { RequestFormat } from "@crm/ai-gateway";
import { generateText, streamText, tool } from "ai";
import { z } from "zod";
import {
	cloudflareModel,
	unavailableModel,
} from "../agent/lib/cloudflare-model";

const accountId = "0".repeat(32);
const apiToken = "test-cloudflare-token";
const lookup = tool({
	description: "Look up a record",
	inputSchema: z.object({ id: z.string() }),
});

describe("Cloudflare model transport", () => {
	it.each([
		["chat-completions", "google/gemini-2.5-flash", "chat/completions"],
		["responses", "openai/gpt-4.1", "responses"],
		["anthropic-messages", "anthropic/claude-sonnet-4.6", "messages"],
	] as const)(
		"routes %s through Cloudflare and preserves tool calls",
		async (requestFormat, id, path) => {
			const request: typeof fetch = Object.assign(
				async (input: string | URL | Request, init?: RequestInit) => {
					expect(String(input)).toBe(
						`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/${path}`,
					);
					const headers = new Headers(init?.headers);
					expect(headers.get("authorization")).toBe(`Bearer ${apiToken}`);
					expect(headers.get("cf-aig-skip-cache")).toBe("true");
					expect(init?.redirect).toBe("error");
					const body = JSON.parse(String(init?.body));
					expect(body.model).toBe(id);
					if (requestFormat === "responses") {
						expect(body.store).toBe(false);
						expect(body.max_output_tokens).toBe(8192);
					} else expect(body.max_tokens).toBe(8192);
					expect(JSON.stringify(body.tools)).toContain("lookup");
					if (requestFormat === "anthropic-messages")
						return Response.json({
							id: "msg_1",
							type: "message",
							role: "assistant",
							model: id,
							content: [
								{
									type: "tool_use",
									id: "call_1",
									name: "lookup",
									input: { id: "record-1" },
								},
							],
							stop_reason: "tool_use",
							stop_sequence: null,
							usage: { input_tokens: 10, output_tokens: 5 },
						});
					if (requestFormat === "responses")
						return Response.json({
							id: "resp_1",
							created_at: 1,
							model: id,
							status: "completed",
							output: [
								{
									type: "function_call",
									id: "fc_1",
									call_id: "call_1",
									name: "lookup",
									arguments: '{"id":"record-1"}',
									status: "completed",
								},
							],
							usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
						});
					return Response.json({
						id: "chat_1",
						created: 1,
						model: id,
						choices: [
							{
								index: 0,
								message: {
									role: "assistant",
									content: null,
									tool_calls: [
										{
											id: "call_1",
											type: "function",
											function: {
												name: "lookup",
												arguments: '{"id":"record-1"}',
											},
										},
									],
								},
								finish_reason: "tool_calls",
							},
						],
						usage: {
							prompt_tokens: 10,
							completion_tokens: 5,
							total_tokens: 15,
						},
					});
				},
				{ preconnect: fetch.preconnect },
			);
			const result = await generateText({
				model: cloudflareModel(
					{ id, requestFormat, maxOutputTokens: 8192 },
					accountId,
					apiToken,
					request,
				),
				prompt: "Look up record-1",
				tools: { lookup },
				maxRetries: 0,
			});
			expect(result.toolCalls[0]?.toolName).toBe("lookup");
			expect(result.toolCalls[0]?.input).toEqual({ id: "record-1" });
		},
	);

	it("streams a tool call without dropping argument fragments", async () => {
		const chunks = [
			{
				choices: [
					{
						index: 0,
						delta: {
							role: "assistant",
							tool_calls: [
								{
									index: 0,
									id: "call_1",
									type: "function",
									function: { name: "lookup", arguments: '{"id":' },
								},
							],
						},
						finish_reason: null,
					},
				],
			},
			{
				choices: [
					{
						index: 0,
						delta: {
							tool_calls: [
								{ index: 0, function: { arguments: '"record-1"}' } },
							],
						},
						finish_reason: null,
					},
				],
			},
			{
				choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
				usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
			},
		];
		const request = Object.assign(
			async () =>
				new Response(
					`${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`,
					{ headers: { "content-type": "text/event-stream" } },
				),
			{ preconnect: fetch.preconnect },
		);
		const result = streamText({
			model: cloudflareModel(
				{ id: "google/gemini-2.5-flash", requestFormat: "chat-completions" },
				accountId,
				apiToken,
				request,
			),
			prompt: "Look up record-1",
			tools: { lookup },
			maxRetries: 0,
		});
		await result.consumeStream();
		expect((await result.toolCalls)[0]?.input).toEqual({ id: "record-1" });
	});

	it("fails closed without setup and redacts provider error bodies", async () => {
		await expect(
			generateText({
				model: unavailableModel(),
				prompt: "Hello",
				maxRetries: 0,
			}),
		).rejects.toThrow("Enter a Cloudflare key");
		const request = Object.assign(
			async () => new Response(`secret echo ${apiToken}`, { status: 401 }),
			{ preconnect: fetch.preconnect },
		);
		await expect(
			generateText({
				model: cloudflareModel(
					{
						id: "google/gemini-2.5-flash",
						requestFormat: "chat-completions" as RequestFormat,
					},
					accountId,
					apiToken,
					request,
				),
				prompt: "Hello",
				maxRetries: 0,
			}),
		).rejects.toThrow("Cloudflare refused the key");
	});
});
