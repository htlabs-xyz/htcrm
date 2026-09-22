import { describe, expect, it } from "bun:test";
import { fetchGatewayCatalog, parseCatalogModel } from "../src/catalog";

const accountId = "0".repeat(32);
const entry = {
	model_id: "openai/gpt-4.1",
	provider_id: "openai",
	name: "GPT-4.1",
	task: "Text Generation",
	context_length: 1047576,
	request_formats: ["responses", "chat-completions"],
	pricing: { "Input tokens (per 1M)": 2, "Output tokens (per 1M)": 8 },
};

describe("Cloudflare catalog", () => {
	it("keeps the catalog's protocol, context and per-token price", () => {
		expect(parseCatalogModel(entry)).toEqual({
			id: entry.model_id,
			provider: "openai",
			name: "GPT-4.1",
			contextWindowTokens: 1047576,
			maxOutputTokens: null,
			requestFormat: "responses",
			pricing: { input: 0.000002, output: 0.000008 },
		});
	});
	it("excludes incomplete or unsupported records without inventing metadata", () => {
		for (const change of [
			{ context_length: null },
			{ request_formats: null },
			{ request_formats: ["audio"] },
			{ task: "Text-to-Image" },
		])
			expect(parseCatalogModel({ ...entry, ...change })).toBeNull();
		expect(
			parseCatalogModel({
				...entry,
				pricing: { "Long-context input (per 1M)": 20 },
			})?.pricing,
		).toBeNull();
	});
	it("loads every page and does not forward the token to redirects", async () => {
		const pages: string[] = [];
		const request: typeof fetch = Object.assign(
			async (input: string | URL | Request, init?: RequestInit) => {
				const url = new URL(String(input));
				pages.push(url.searchParams.get("page") ?? "");
				expect(url.origin).toBe("https://api.cloudflare.com");
				expect(init?.redirect).toBe("error");
				expect(new Headers(init?.headers).get("authorization")).toBe(
					"Bearer test-token",
				);
				return Response.json({
					success: true,
					result: [{ ...entry, model_id: `model/${pages.length}` }],
					result_info: { total_count: 2 },
				});
			},
			{ preconnect: fetch.preconnect },
		);
		expect(
			(await fetchGatewayCatalog(accountId, "test-token", request)).map(
				(model) => model.id,
			),
		).toEqual(["model/1", "model/2"]);
		expect(pages).toEqual(["1", "2"]);
	});
	it("rejects auth errors, malformed success and incomplete pages with safe messages", async () => {
		for (const response of [
			new Response("secret-provider-message", { status: 401 }),
			Response.json({ success: false }),
			Response.json({
				success: true,
				result: [],
				result_info: { total_count: 2 },
			}),
		]) {
			const request = Object.assign(async () => response, {
				preconnect: fetch.preconnect,
			});
			await expect(
				fetchGatewayCatalog(accountId, "secret-token", request),
			).rejects.toThrow(/Cloudflare/);
		}
	});
});
