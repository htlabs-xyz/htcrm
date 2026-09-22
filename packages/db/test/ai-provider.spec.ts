import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { env } from "node:process";
import { decryptProviderKey, encryptProviderKey } from "../src/ai-provider";
import { AI_PROVIDER } from "../src/ai-provider-config";
import {
	providerAddress,
	providerBaseUrl,
	providerJson,
	providerRequest,
} from "../src/ai-provider-http";

const previousSecret = env.BETTER_AUTH_SECRET;
beforeAll(() => {
	env.BETTER_AUTH_SECRET = "provider-tests-only-secret-at-least-32-characters";
});
afterAll(() => {
	if (previousSecret === undefined) delete env.BETTER_AUTH_SECRET;
	else env.BETTER_AUTH_SECRET = previousSecret;
});

describe("AI provider key encryption", () => {
	it("uses random ciphertext and binds it to one provider", () => {
		const first = encryptProviderKey("provider-test-key", "provider-one");
		const second = encryptProviderKey("provider-test-key", "provider-one");
		expect(first).not.toEqual(second);
		expect(first).not.toContain("provider-test-key");
		expect(decryptProviderKey(first, "provider-one")).toBe("provider-test-key");
		expect(() => decryptProviderKey(first, "provider-two")).toThrow(
			"could not be opened",
		);
	});
	it("rejects corrupt ciphertext and changed encryption secrets", () => {
		const encrypted = encryptProviderKey("provider-test-key", "one");
		expect(() => decryptProviderKey(`${encrypted}:extra`, "one")).toThrow();
		env.BETTER_AUTH_SECRET =
			"replacement-tests-only-secret-at-least-32-characters";
		expect(() => decryptProviderKey(encrypted, "one")).toThrow();
		env.BETTER_AUTH_SECRET =
			"provider-tests-only-secret-at-least-32-characters";
	});
});

describe("provider endpoint transport", () => {
	it("preserves API prefixes and normalizes trailing slashes", () => {
		expect(providerBaseUrl(" https://api.example.com/custom/v1/ ")).toBe(
			"https://api.example.com/custom/v1",
		);
		expect(providerBaseUrl("https://api.example.com")).toBe(
			"https://api.example.com",
		);
	});
	it("rejects credentials, full operation paths, private IPs and non-HTTPS URLs", () => {
		for (const url of [
			"http://api.example.com/v1",
			"https://user:key@api.example.com",
			"https://api.example.com/?key=secret",
			"https://api.example.com/#fragment",
			"https://api.example.com/v1/chat/completions",
			"https://127.1",
			"https://[::1]",
			"https://[::ffff:127.0.0.1]",
			"https://169.254.169.254",
			"https://localhost/v1",
			"file:///etc/passwd",
		])
			expect(() => providerBaseUrl(url)).toThrow();
	});
	it("rejects mixed public and private DNS answers", async () => {
		const lookup = (async () => [
			{ address: "8.8.8.8", family: 4 },
			{ address: "10.0.0.1", family: 4 },
		]) as Parameters<typeof providerAddress>[1];
		await expect(providerAddress("api.example.com", lookup)).rejects.toThrow(
			"public IP",
		);
		await expect(providerAddress("192.168.1.1")).rejects.toThrow("public IP");
	});
	it("selects a checked public address for the actual connection", async () => {
		const lookup = (async () => [
			{ address: "8.8.8.8", family: 4 },
		]) as Parameters<typeof providerAddress>[1];
		expect(await providerAddress("api.example.com", lookup)).toBe("8.8.8.8");
	});
	it("blocks local requests before credentials leave", async () => {
		await expect(
			providerRequest("https://127.0.0.1", "test-key", "models"),
		).rejects.toThrow("public HTTPS");
	});
	it("bounds catalogs and rejects malformed JSON", async () => {
		expect(await providerJson(Response.json({ data: [] }))).toEqual({
			data: [],
		});
		await expect(
			providerJson(new Response("x".repeat(AI_PROVIDER.maxCatalogBytes + 1))),
		).rejects.toThrow("too large");
		await expect(providerJson(new Response("not-json"))).rejects.toThrow();
	});
});
