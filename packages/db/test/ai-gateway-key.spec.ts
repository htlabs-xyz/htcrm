import { afterEach, describe, expect, it } from "bun:test";
import { env } from "node:process";
import { decryptGatewayKey, encryptGatewayKey } from "../src/ai-gateway-key";

const original = env.BETTER_AUTH_SECRET;
afterEach(() => {
	if (original === undefined) delete env.BETTER_AUTH_SECRET;
	else env.BETTER_AUTH_SECRET = original;
});

describe("Cloudflare key encryption", () => {
	it("encrypts with fresh nonces and opens the original token", () => {
		env.BETTER_AUTH_SECRET = "test-auth-secret-".repeat(4);
		const token = "test-cloudflare-token-not-a-real-secret";
		const encrypted = encryptGatewayKey(token);
		expect(encrypted).not.toContain(token);
		expect(encrypted).not.toBe(encryptGatewayKey(token));
		expect(decryptGatewayKey(encrypted)).toBe(token);
	});
	it("rejects tampering and secret rotation without exposing either value", () => {
		env.BETTER_AUTH_SECRET = "original-auth-secret-".repeat(4);
		const encrypted = encryptGatewayKey("private-token");
		expect(() => decryptGatewayKey(encrypted.replace("v1:", "v2:"))).toThrow(
			"Re-enter the Cloudflare key",
		);
		env.BETTER_AUTH_SECRET = "changed-auth-secret-".repeat(4);
		expect(() => decryptGatewayKey(encrypted)).toThrow(
			"Re-enter the Cloudflare key",
		);
	});
});
