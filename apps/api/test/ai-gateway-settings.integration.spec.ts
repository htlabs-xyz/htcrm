import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	spyOn,
} from "bun:test";
import { env } from "node:process";
import { db, type Prisma } from "@crm/db";
import { readGatewayKey } from "@crm/db/ai-gateway-key";
import { SETTINGS_ID } from "@crm/db/settings";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Test } from "@nestjs/testing";
import { createCache } from "cache-manager";
import { ResearchKeyService } from "../src/agent/research-key.service";
import { BackfillService } from "../src/backfill/backfill.service";
import { DATABASE } from "../src/database/database.constants";
import { ModelCatalogService } from "../src/settings/model-catalog.service";
import { SettingsService } from "../src/settings/settings.service";

const originalAccount = env.CLOUDFLARE_ACCOUNT_ID;
const originalGateway = env.CLOUDFLARE_GATEWAY_ID;
let saved: Prisma.AppSettingUncheckedCreateInput | null;
let settings: SettingsService;
let network: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
const entry = {
	model_id: "google/gemini-2.5-flash",
	provider_id: "google",
	name: "Gemini",
	task: "Text Generation",
	context_length: 1000000,
	request_formats: ["chat-completions"],
	max_output_tokens: 8192,
};

beforeAll(async () => {
	saved = await db.appSetting.findUnique({ where: { id: SETTINGS_ID } });
	const module = await Test.createTestingModule({
		providers: [
			SettingsService,
			ModelCatalogService,
			{ provide: DATABASE, useValue: db },
			{ provide: CACHE_MANAGER, useValue: createCache() },
			{ provide: ResearchKeyService, useValue: {} },
			{ provide: BackfillService, useValue: {} },
		],
	}).compile();
	settings = module.get(SettingsService);
	env.CLOUDFLARE_ACCOUNT_ID = "0".repeat(32);
	env.CLOUDFLARE_GATEWAY_ID = "gateway";
});

afterEach(() => network?.mockRestore());
afterAll(async () => {
	if (saved)
		await db.appSetting.update({
			where: { id: SETTINGS_ID },
			data: {
				cloudflareApiToken: saved.cloudflareApiToken,
				agentModelId: saved.agentModelId,
				agentModelContextWindow: saved.agentModelContextWindow,
			},
		});
	else await db.appSetting.deleteMany({ where: { id: SETTINGS_ID } });
	if (originalAccount === undefined) delete env.CLOUDFLARE_ACCOUNT_ID;
	else env.CLOUDFLARE_ACCOUNT_ID = originalAccount;
	if (originalGateway === undefined) delete env.CLOUDFLARE_GATEWAY_ID;
	else env.CLOUDFLARE_GATEWAY_ID = originalGateway;
});

function mockNetwork(
	respond: (...args: Parameters<typeof fetch>) => Promise<Response>,
) {
	network?.mockRestore();
	network = spyOn(globalThis, "fetch").mockImplementation(
		Object.assign(respond, { preconnect: fetch.preconnect }),
	);
}

describe("Cloudflare Settings", () => {
	it("saves ciphertext, returns only a hint, selects a model, and removes access", async () => {
		mockNetwork(async (input) =>
			Response.json({
				success: true,
				result: String(input).includes("provider_configs")
					? [{ provider_slug: "google-ai-studio", alias: "default" }]
					: [entry],
				result_info: { total_count: 1 },
			}),
		);
		const token = "test-cloudflare-token-1234";
		const result = await settings.setAiGatewayKey(token);
		expect(result).toEqual({
			configured: true,
			hint: "••••1234",
			accountConfigured: true,
			needsReplacement: false,
		});
		expect(JSON.stringify(result)).not.toContain(token);
		const stored = await db.appSetting.findUniqueOrThrow({
			where: { id: SETTINGS_ID },
		});
		expect(stored.cloudflareApiToken).not.toContain(token);
		expect(await readGatewayKey(db)).toBe(token);
		expect(
			(await settings.modelCatalog()).models.map((model) => model.id),
		).toEqual([entry.model_id]);
		expect((await settings.setAgentModel(entry.model_id)).selectedId).toBe(
			entry.model_id,
		);
		await settings.setAiGatewayKey(null);
		expect(await settings.modelCatalog()).toEqual({
			available: false,
			models: [],
		});
		expect(await readGatewayKey(db)).toBeNull();
	});
	it("refuses an invalid replacement and keeps the working key", async () => {
		mockNetwork(async (input) =>
			Response.json({
				success: true,
				result: String(input).includes("provider_configs")
					? [{ provider_slug: "google-ai-studio", alias: "default" }]
					: [entry],
				result_info: { total_count: 1 },
			}),
		);
		await settings.setAiGatewayKey("test-working-token-5678");
		mockNetwork(
			async () => new Response("private provider error", { status: 403 }),
		);
		await expect(
			settings.setAiGatewayKey("test-rejected-token-0000"),
		).rejects.toThrow("Workers AI Read");
		expect(await readGatewayKey(db)).toBe("test-working-token-5678");
	});
	it("rotates catalog credentials and rejects models outside Cloudflare", async () => {
		mockNetwork(async (input, init) => {
			expect(new Headers(init?.headers).get("authorization")).toBe(
				"Bearer test-replacement-token-9012",
			);
			return Response.json({
				success: true,
				result: String(input).includes("provider_configs")
					? [{ provider_slug: "google-ai-studio", alias: "default" }]
					: [entry],
				result_info: { total_count: 1 },
			});
		});
		await settings.setAiGatewayKey("test-replacement-token-9012");
		await settings.modelCatalog();
		expect(network).toHaveBeenCalledTimes(4);
		await expect(settings.setAgentModel("zai/glm-5.2-fast")).rejects.toThrow(
			"does not list",
		);
	});
	it("does not reuse a catalog after changing the gateway", async () => {
		const requested: string[] = [];
		mockNetwork(async (input) => {
			requested.push(String(input));
			return Response.json({
				success: true,
				result: String(input).includes("provider_configs") ? [] : [entry],
				result_info: { total_count: 0 },
			});
		});
		try {
			env.CLOUDFLARE_GATEWAY_ID = "another-gateway";
			expect(await settings.modelCatalog()).toEqual({
				available: true,
				models: [],
			});
			expect(requested).toHaveLength(1);
			expect(requested[0]).toContain(
				"/gateways/another-gateway/provider_configs",
			);
		} finally {
			env.CLOUDFLARE_GATEWAY_ID = "gateway";
		}
	});
});
