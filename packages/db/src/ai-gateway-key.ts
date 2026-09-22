import {
	createCipheriv,
	createDecipheriv,
	hkdfSync,
	randomBytes,
} from "node:crypto";
import { env } from "node:process";
import type { Db } from "./client";
import { SETTINGS_ID } from "./settings";

function encryptionKey(): Buffer {
	const secret = env.BETTER_AUTH_SECRET;
	if (!secret || secret.length < 32) {
		throw new Error(
			"Configure BETTER_AUTH_SECRET before saving a Cloudflare key.",
		);
	}
	return Buffer.from(
		hkdfSync("sha256", secret, "crm", "cloudflare-api-token", 32),
	);
}

export function encryptGatewayKey(apiToken: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
	const encrypted = Buffer.concat([
		cipher.update(apiToken.trim(), "utf8"),
		cipher.final(),
	]);
	return [
		"v1",
		iv.toString("base64"),
		cipher.getAuthTag().toString("base64"),
		encrypted.toString("base64"),
	].join(":");
}

export function decryptGatewayKey(value: string): string {
	try {
		const [version, iv, tag, data, extra] = value.split(":");
		if (version !== "v1" || !iv || !tag || !data || extra !== undefined)
			throw new Error();
		const decipher = createDecipheriv(
			"aes-256-gcm",
			encryptionKey(),
			Buffer.from(iv, "base64"),
		);
		decipher.setAuthTag(Buffer.from(tag, "base64"));
		return Buffer.concat([
			decipher.update(Buffer.from(data, "base64")),
			decipher.final(),
		]).toString("utf8");
	} catch {
		throw new Error(
			"Re-enter the Cloudflare key in Settings. The saved key could not be opened.",
		);
	}
}

export async function readGatewayKey(db: Db): Promise<string | null> {
	const row = await db.appSetting.findUnique({
		where: { id: SETTINGS_ID },
		select: { cloudflareApiToken: true },
	});
	return row?.cloudflareApiToken
		? decryptGatewayKey(row.cloudflareApiToken)
		: null;
}

export async function writeGatewayKey(
	db: Db,
	apiToken: string | null,
): Promise<void> {
	const cloudflareApiToken = apiToken ? encryptGatewayKey(apiToken) : null;
	await db.appSetting.upsert({
		where: { id: SETTINGS_ID },
		create: { id: SETTINGS_ID, cloudflareApiToken },
		update: { cloudflareApiToken },
	});
}
