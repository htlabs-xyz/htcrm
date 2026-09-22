import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	spyOn,
} from "bun:test";
import { db } from "@crm/db";
import { decryptProviderKey, readAiProvider } from "@crm/db/ai-provider";
import { SETTINGS_ID } from "@crm/db/settings";
import { AiProviderService } from "../src/settings/ai-provider.service";
import {
	ModelCatalogService,
	parseProviderCatalog,
} from "../src/settings/model-catalog.service";

const service = new AiProviderService(db, new ModelCatalogService(db));
const verify = spyOn(service, "verify");
let original: Awaited<ReturnType<typeof db.appSetting.findUnique>>;
const candidate = {
	baseUrl: "https://api.example.com/v1",
	apiKey: "test-provider-key",
	modelId: "custom-model",
	contextWindowTokens: 32000,
	maxOutputTokens: 2000,
	revision: null,
};

beforeAll(async () => {
	original = await db.appSetting.findUnique({ where: { id: SETTINGS_ID } });
});
beforeEach(async () => {
	await db.appSetting.deleteMany({ where: { id: SETTINGS_ID } });
	verify.mockResolvedValue({ ok: true, message: "Verified" });
});
afterAll(async () => {
	verify.mockRestore();
	await db.appSetting.deleteMany({ where: { id: SETTINGS_ID } });
	if (original) await db.appSetting.create({ data: original });
});

describe("shared OpenAI-compatible settings", () => {
	it("does not report a partially configured provider as ready", async () => {
		await service.save(candidate);
		await db.appSetting.update({
			where: { id: SETTINGS_ID },
			data: { agentModelId: null },
		});
		expect((await service.settings()).configured).toBe(false);
	});
	it("stores a manual model without depending on a catalog and hides the key", async () => {
		const saved = await service.save(candidate);
		expect(saved.configured).toBe(true);
		expect(saved.modelId).toBe("custom-model");
		expect(JSON.stringify(saved)).not.toContain(candidate.apiKey);
		const row = await readAiProvider(db);
		expect(row?.aiProviderApiKey).not.toBe(candidate.apiKey);
		if (!row?.aiProviderApiKey || !row.aiProviderId)
			throw new Error("Missing saved key");
		expect(decryptProviderKey(row.aiProviderApiKey, row.aiProviderId)).toBe(
			candidate.apiKey,
		);
	});
	it("preserves the entire working configuration after a failed model test", async () => {
		const saved = await service.save(candidate);
		const before = await readAiProvider(db);
		verify.mockResolvedValue({
			ok: false,
			message: "Tool calling is unavailable",
		});
		await expect(
			service.save({
				...candidate,
				apiKey: "replacement-key",
				revision: saved.revision,
			}),
		).rejects.toThrow("Tool calling");
		expect(await readAiProvider(db)).toEqual(before);
	});
	it("never reuses a saved key at another endpoint", async () => {
		const saved = await service.save(candidate);
		await expect(
			service.candidate({
				baseUrl: "https://another.example.com",
				revision: saved.revision,
			}),
		).rejects.toThrow("requires its key");
		const same = await service.candidate({
			baseUrl: `${candidate.baseUrl}/`,
			revision: saved.revision,
		});
		expect(same.apiKey).toBe(candidate.apiKey);
	});
	it("keeps endpoint identity on key rotation and model changes", async () => {
		const saved = await service.save(candidate);
		const before = await readAiProvider(db);
		await service.save({
			...candidate,
			apiKey: "rotated-test-key",
			modelId: "another-model",
			revision: saved.revision,
		});
		const after = await readAiProvider(db);
		expect(after?.aiProviderId).toBe(before?.aiProviderId);
		expect(after?.aiProviderRevision).not.toBe(before?.aiProviderRevision);
	});
	it("changes endpoint identity on replacement and rejects stale writes", async () => {
		const saved = await service.save(candidate);
		const before = await readAiProvider(db);
		await service.save({
			...candidate,
			baseUrl: "https://another.example.com",
			revision: saved.revision,
		});
		expect((await readAiProvider(db))?.aiProviderId).not.toBe(
			before?.aiProviderId,
		);
		await expect(service.remove(saved.revision)).rejects.toThrow("changed");
	});
	it("rejects a result verified against a configuration that changed meanwhile", async () => {
		const saved = await service.save(candidate);
		verify.mockImplementationOnce(async () => {
			await service.remove(saved.revision);
			return { ok: true, message: "Verified" };
		});
		await expect(
			service.save({ ...candidate, revision: saved.revision }),
		).rejects.toThrow("changed");
		expect((await service.settings()).configured).toBe(false);
	});
	it("removes provider credentials without changing currency or legacy migration data", async () => {
		const saved = await service.save(candidate);
		await db.appSetting.update({
			where: { id: SETTINGS_ID },
			data: {
				reportingCurrency: "VND",
				cloudflareApiToken: "legacy-encrypted-test-value",
			},
		});
		expect((await service.remove(saved.revision)).configured).toBe(false);
		const row = await db.appSetting.findUniqueOrThrow({
			where: { id: SETTINGS_ID },
		});
		expect(row.aiProviderApiKey).toBeNull();
		expect(row.agentModelId).toBeNull();
		expect(row.reportingCurrency).toBe("VND");
		expect(row.cloudflareApiToken).toBe("legacy-encrypted-test-value");
	});
	it("accepts basic model catalogs without invented context or price", () => {
		const list = parseProviderCatalog({
			data: [{ id: "private/model", owned_by: "provider" }],
		});
		expect(list).toEqual([
			{
				id: "private/model",
				name: "private/model",
				provider: "provider",
				contextWindowTokens: null,
				maxOutputTokens: null,
				pricing: null,
			},
		]);
		expect(
			parseProviderCatalog({
				data: [
					{ id: "one", context_length: 32000 },
					{ id: "one", context_window: 64000 },
					{ broken: true },
				],
			})[0]?.contextWindowTokens,
		).toBe(64000);
	});
});
