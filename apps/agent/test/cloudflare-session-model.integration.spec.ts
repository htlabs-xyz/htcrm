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
import type { GatewayModel } from "@crm/ai-gateway";
import { db, type Prisma } from "@crm/db";
import { writeGatewayKey } from "@crm/db/ai-gateway-key";
import { SETTINGS_ID } from "@crm/db/settings";
import { cloudflareSessionModel } from "../agent/lib/cloudflare-session-model";

const originalAccount = env.CLOUDFLARE_ACCOUNT_ID;
const originalGateway = env.CLOUDFLARE_GATEWAY_ID;
let saved: Prisma.AppSettingUncheckedCreateInput | null;
let network: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
const first = {
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
	env.CLOUDFLARE_ACCOUNT_ID = "0".repeat(32);
	env.CLOUDFLARE_GATEWAY_ID = "gateway";
});
afterEach(() => network?.mockRestore());
afterAll(async () => {
	if (saved)
		await db.appSetting.update({
			where: { id: SETTINGS_ID },
			data: { cloudflareApiToken: saved.cloudflareApiToken },
		});
	else await db.appSetting.deleteMany({ where: { id: SETTINGS_ID } });
	if (originalAccount === undefined) delete env.CLOUDFLARE_ACCOUNT_ID;
	else env.CLOUDFLARE_ACCOUNT_ID = originalAccount;
	if (originalGateway === undefined) delete env.CLOUDFLARE_GATEWAY_ID;
	else env.CLOUDFLARE_GATEWAY_ID = originalGateway;
});

function session(savedModel: GatewayModel | null = null) {
	let model = savedModel;
	return {
		get: () => model,
		update: (change: (value: GatewayModel | null) => GatewayModel | null) => {
			model = change(model);
		},
	};
}

describe("Cloudflare session model", () => {
	it("pins the model across settings changes and restores without persisting credentials", async () => {
		await writeGatewayKey(db, "test-original-cloudflare-token");
		network = spyOn(globalThis, "fetch").mockImplementation(async (input) =>
			Response.json({
				success: true,
				result: String(input).includes("provider_configs")
					? [{ provider_slug: "google-ai-studio", alias: "default" }]
					: [first],
				result_info: { total_count: 1 },
			}),
		);
		const state = session();
		const initial = await cloudflareSessionModel(
			async () => ({ model: first.model_id, modelContextWindowTokens: 500000 }),
			state,
		);
		expect(initial.model.modelId).toBe(first.model_id);
		expect(initial.modelContextWindowTokens).toBe(500000);
		expect(state.get()?.maxOutputTokens).toBe(8192);
		expect(JSON.stringify(state.get())).not.toContain("token");
		const restored = session(JSON.parse(JSON.stringify(state.get())));
		await writeGatewayKey(db, "test-rotated-cloudflare-token");
		const resumed = await cloudflareSessionModel(async () => {
			throw new Error("An open session must not reread the model choice");
		}, restored);
		expect(resumed.model.modelId).toBe(first.model_id);
		expect(network).toHaveBeenCalledTimes(2);
		await writeGatewayKey(db, null);
		expect(
			(await cloudflareSessionModel(async () => null, restored)).model.modelId,
		).toBe("unconfigured");
	});
	it("uses the immutable team-agent selection and fails closed for a Vercel-only model", async () => {
		await writeGatewayKey(db, "test-team-cloudflare-token");
		network = spyOn(globalThis, "fetch").mockImplementation(async (input) =>
			Response.json({
				success: true,
				result: String(input).includes("provider_configs")
					? [{ provider_slug: "google-ai-studio", alias: "default" }]
					: [first],
				result_info: { total_count: 1 },
			}),
		);
		expect(
			(
				await cloudflareSessionModel(
					async () => ({
						model: first.model_id,
						modelContextWindowTokens: 200000,
					}),
					session(),
				)
			).modelContextWindowTokens,
		).toBe(200000);
		const unsupported = await cloudflareSessionModel(
			async () => ({
				model: "zai/glm-5.2-fast",
				modelContextWindowTokens: 1000000,
			}),
			session(),
		);
		expect(unsupported.model.modelId).toBe("unconfigured");
		await expect(unsupported.model.doGenerate({ prompt: [] })).rejects.toThrow(
			"saved model is unavailable on Cloudflare",
		);
	});
});
