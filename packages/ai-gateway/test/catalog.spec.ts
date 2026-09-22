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
	it("lists native DeepSeek Flash and only providers with a default BYOK key", async () => {
		const request = Object.assign(
			async (input: string | URL | Request) => {
				const url = String(input);
				if (url.includes("provider_configs"))
					return Response.json({
						success: true,
						result: [
							{ provider_slug: "deepseek", alias: "default" },
							{ provider_slug: "google", alias: "testing" },
						],
						result_info: { total_count: 2 },
					});
				if (url.endsWith("/deepseek/models"))
					return Response.json({
						data: [{ id: "deepseek-flash" }, { id: "deepseek-v4-pro" }],
					});
				return Response.json({
					success: true,
					result: [entry],
					result_info: { total_count: 1 },
				});
			},
			{ preconnect: fetch.preconnect },
		);
		const models = await fetchGatewayCatalog(
			accountId,
			"test-token",
			request,
			"gateway",
		);
		expect(models.map((model) => model.id).sort()).toEqual([
			"deepseek/deepseek-flash",
			"deepseek/deepseek-v4-pro",
		]);
		expect(models[0]?.contextWindowTokens).toBe(1048576);
		expect(models[0]?.maxOutputTokens).toBe(393216);
		expect(models[0]?.pricing).toBeNull();
	});
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
	it("authenticates native discovery and excludes unknown provider models", async () => {
		const request = Object.assign(
			async (input: string | URL | Request, init?: RequestInit) => {
				if (String(input).includes("provider_configs"))
					return Response.json({
						success: true,
						result: [
							{
								provider_slug: "deepseek",
								alias: "default",
								default_config: 0,
							},
						],
						result_info: { total_count: 1 },
					});
				const headers = new Headers(init?.headers);
				expect(headers.get("authorization")).toBeNull();
				expect(headers.get("cf-aig-authorization")).toBe("Bearer test-token");
				expect(headers.get("cf-aig-no-wholesale")).toBe("true");
				expect(init?.redirect).toBe("error");
				return Response.json({
					data: [{ id: "deepseek-flash" }, { id: "unknown-model" }],
				});
			},
			{ preconnect: fetch.preconnect },
		);
		expect(
			(
				await fetchGatewayCatalog(accountId, "test-token", request, "gateway")
			).map((model) => model.id),
		).toEqual(["deepseek/deepseek-flash"]);
	});
	it("paginates provider keys and maps Google AI Studio to catalog models", async () => {
		const pages: string[] = [];
		const request = Object.assign(
			async (input: string | URL | Request) => {
				const url = new URL(String(input));
				if (url.pathname.endsWith("provider_configs")) {
					const page = url.searchParams.get("page") ?? "";
					pages.push(page);
					return Response.json({
						success: true,
						result: [
							{
								provider_slug: "google-ai-studio",
								alias: page === "1" ? "test" : "default",
							},
						],
						result_info: { total_count: 2 },
					});
				}
				return Response.json({
					success: true,
					result: [
						{ ...entry, model_id: "google/gemini", provider_id: "google" },
						entry,
					],
					result_info: { total_count: 2 },
				});
			},
			{ preconnect: fetch.preconnect },
		);
		const models = await fetchGatewayCatalog(
			accountId,
			"test-token",
			request,
			"gateway",
		);
		expect(pages).toEqual(["1", "2"]);
		expect(models.map((model) => model.id)).toEqual(["google/gemini"]);
		expect(models[0]?.pricing).toBeNull();
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
				if (url.pathname.endsWith("provider_configs"))
					return Response.json({
						success: true,
						result: [{ provider_slug: "openai", alias: "default" }],
						result_info: { total_count: 1 },
					});
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
			(
				await fetchGatewayCatalog(accountId, "test-token", request, "gateway")
			).map((model) => model.id),
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
				fetchGatewayCatalog(accountId, "secret-token", request, "gateway"),
			).rejects.toThrow(/Cloudflare/);
		}
	});
});
