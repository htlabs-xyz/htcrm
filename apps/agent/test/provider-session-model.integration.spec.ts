import { afterAll, beforeAll, beforeEach, expect, it } from "bun:test";
import { db } from "@crm/db";
import { readAiProvider, writeAiProvider } from "@crm/db/ai-provider";
import { SETTINGS_ID } from "@crm/db/settings";
import {
	type ProviderModelSelection,
	providerSessionModel,
} from "../agent/lib/provider-session-model";

let original: Awaited<ReturnType<typeof db.appSetting.findUnique>>;
let selected: ProviderModelSelection | null = null;
const state = {
	get: () => selected,
	update: (
		fn: (
			previous: ProviderModelSelection | null,
		) => ProviderModelSelection | null,
	) => {
		selected = fn(selected);
	},
};
const config = {
	baseUrl: "https://api.example.com/v1",
	apiKey: "session-test-key",
	modelId: "first-model",
	contextWindowTokens: 32000,
	maxOutputTokens: 2000,
};
beforeAll(async () => {
	original = await db.appSetting.findUnique({ where: { id: SETTINGS_ID } });
});
beforeEach(async () => {
	selected = null;
	await db.appSetting.deleteMany({ where: { id: SETTINGS_ID } });
});
afterAll(async () => {
	await db.appSetting.deleteMany({ where: { id: SETTINGS_ID } });
	if (original) await db.appSetting.create({ data: original });
});

it("fails without configuration instead of falling back to a gateway", async () => {
	const result = await providerSessionModel(undefined, state);
	expect(result.model.modelId).toBe("unconfigured");
	await expect(result.model.doGenerate({ prompt: [] })).rejects.toThrow(
		"Configure",
	);
});
it("pins model and limits while the shared default changes", async () => {
	await writeAiProvider(db, config, null);
	const first = await providerSessionModel(undefined, state);
	const row = await readAiProvider(db);
	await writeAiProvider(
		db,
		{
			...config,
			modelId: "second-model",
			apiKey: "rotated-key",
			contextWindowTokens: 64000,
		},
		row!.aiProviderRevision,
	);
	const second = await providerSessionModel(undefined, state);
	expect(first.model.modelId).toBe("first-model");
	expect(second.model.modelId).toBe("first-model");
	expect(second.modelContextWindowTokens).toBe(32000);
	expect(JSON.stringify(selected)).not.toContain("key");
	selected = null;
	expect((await providerSessionModel(undefined, state)).model.modelId).toBe(
		"second-model",
	);
});
it("refuses to send an existing session to a replacement endpoint", async () => {
	await writeAiProvider(db, config, null);
	await providerSessionModel(undefined, state);
	const row = await readAiProvider(db);
	await writeAiProvider(
		db,
		{ ...config, baseUrl: "https://another.example.com" },
		row!.aiProviderRevision,
	);
	const result = await providerSessionModel(undefined, state);
	await expect(result.model.doGenerate({ prompt: [] })).rejects.toThrow(
		"endpoint changed",
	);
});
it("uses immutable team-agent model metadata and rejects legacy versions", async () => {
	await writeAiProvider(db, config, null);
	const row = await readAiProvider(db);
	const result = await providerSessionModel(
		async () => ({
			modelId: "deployed-model",
			providerId: row!.aiProviderId!,
			contextWindowTokens: 8000,
			maxOutputTokens: 1000,
		}),
		state,
	);
	expect(result.model.modelId).toBe("deployed-model");
	expect(result.modelContextWindowTokens).toBe(8000);
	selected = null;
	await expect(
		(await providerSessionModel(async () => null, state)).model.doGenerate({
			prompt: [],
		}),
	).rejects.toThrow("rebuild");
});
it("refuses a removed key at the next step", async () => {
	await writeAiProvider(db, config, null);
	await providerSessionModel(undefined, state);
	await writeAiProvider(
		db,
		null,
		(await readAiProvider(db))!.aiProviderRevision,
	);
	expect((await providerSessionModel(undefined, state)).model.modelId).toBe(
		"unconfigured",
	);
});
