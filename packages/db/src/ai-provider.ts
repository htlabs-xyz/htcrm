import {
	createCipheriv,
	createDecipheriv,
	hkdfSync,
	randomBytes,
	randomUUID,
} from "node:crypto";
import { env } from "node:process";
import type { Db } from "./client";
import { SETTINGS_ID } from "./settings";

function encryptionKey(): Buffer {
	const secret = env.BETTER_AUTH_SECRET;
	if (!secret || secret.length < 32)
		throw new Error("Configure BETTER_AUTH_SECRET before saving an AI key.");
	return Buffer.from(
		hkdfSync("sha256", secret, "crm", "openai-compatible-provider", 32),
	);
}

export function encryptProviderKey(key: string, providerId: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
	cipher.setAAD(Buffer.from(providerId));
	const data = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
	return [
		"v1",
		iv.toString("base64"),
		cipher.getAuthTag().toString("base64"),
		data.toString("base64"),
	].join(":");
}

export function decryptProviderKey(value: string, providerId: string): string {
	try {
		const [version, iv, tag, data, extra] = value.split(":");
		if (version !== "v1" || !iv || !tag || !data || extra !== undefined)
			throw new Error();
		const decipher = createDecipheriv(
			"aes-256-gcm",
			encryptionKey(),
			Buffer.from(iv, "base64"),
		);
		decipher.setAAD(Buffer.from(providerId));
		decipher.setAuthTag(Buffer.from(tag, "base64"));
		return Buffer.concat([
			decipher.update(Buffer.from(data, "base64")),
			decipher.final(),
		]).toString("utf8");
	} catch {
		throw new Error(
			"The saved AI key could not be opened. Enter the key again in Settings.",
		);
	}
}

export async function readAiProvider(db: Pick<Db, "appSetting">) {
	return db.appSetting.findUnique({
		where: { id: SETTINGS_ID },
		select: {
			aiProviderId: true,
			aiProviderRevision: true,
			aiProviderBaseUrl: true,
			aiProviderApiKey: true,
			agentModelId: true,
			agentModelContextWindow: true,
			agentModelMaxOutputTokens: true,
		},
	});
}

export type AiProviderRow = Awaited<ReturnType<typeof readAiProvider>>;

export function aiProviderModel(row: AiProviderRow) {
	if (
		!row?.aiProviderId ||
		!row.aiProviderBaseUrl ||
		!row.aiProviderApiKey ||
		!row.agentModelId ||
		!row.agentModelContextWindow ||
		!row.agentModelMaxOutputTokens
	)
		return null;
	return {
		providerId: row.aiProviderId,
		modelId: row.agentModelId,
		contextWindowTokens: row.agentModelContextWindow,
		maxOutputTokens: row.agentModelMaxOutputTokens,
	};
}

export async function writeAiProvider(
	db: Db,
	input: {
		baseUrl: string;
		apiKey: string;
		modelId: string;
		contextWindowTokens: number;
		maxOutputTokens: number;
	} | null,
	expectedRevision: string | null,
) {
	return db.$transaction(async (tx) => {
		const current = await tx.appSetting.findUnique({
			where: { id: SETTINGS_ID },
		});
		if ((current?.aiProviderRevision ?? null) !== expectedRevision)
			throw new Error(
				"AI settings changed. Reload Settings before saving again.",
			);
		const providerId =
			input &&
			current?.aiProviderBaseUrl === input.baseUrl &&
			current.aiProviderId
				? current.aiProviderId
				: randomUUID();
		const fields = {
			aiProviderId: input ? providerId : null,
			aiProviderRevision: randomUUID(),
			aiProviderBaseUrl: input?.baseUrl ?? null,
			aiProviderApiKey: input
				? encryptProviderKey(input.apiKey, providerId)
				: null,
			agentModelId: input?.modelId ?? null,
			agentModelContextWindow: input?.contextWindowTokens ?? null,
			agentModelMaxOutputTokens: input?.maxOutputTokens ?? null,
		};
		if (!current) {
			await tx.appSetting.create({ data: { id: SETTINGS_ID, ...fields } });
		} else {
			const result = await tx.appSetting.updateMany({
				where: { id: SETTINGS_ID, aiProviderRevision: expectedRevision },
				data: fields,
			});
			if (result.count !== 1)
				throw new Error(
					"AI settings changed. Reload Settings before saving again.",
				);
		}
	});
}
