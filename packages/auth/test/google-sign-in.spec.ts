import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";

const probe = `
import assert from "node:assert/strict";
import { auth } from "./src/auth";
import { isWorkspaceEmail } from "./src/workspace";

const context = await auth.$context;
const provider = context.socialProviders.find((entry) => entry.id === "google");
assert.ok(provider);

const url = await provider.createAuthorizationURL({
  state: "google-sign-in-test",
  codeVerifier: "google-sign-in-test-code-verifier",
  redirectURI: "https://crm.example.test/api/auth/callback/google",
});

assert.equal(url.searchParams.get("hd"), scenario.hostedDomain || null);
assert.equal(isWorkspaceEmail(scenario.acceptedEmail), true);
assert.equal(isWorkspaceEmail(scenario.rejectedEmail), false);

const scopes = new Set(url.searchParams.get("scope").split(" "));
for (const scope of ["openid", "email", "profile"]) assert.ok(scopes.has(scope));

const profile = {
  sub: "google-sign-in-test-user",
  name: "Google Sign-in Test",
  email: scenario.acceptedEmail,
  email_verified: true,
  ...(scenario.hostedDomain ? { hd: scenario.hostedDomain } : {}),
};
const idToken = [
  Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url"),
  Buffer.from(JSON.stringify(profile)).toString("base64url"),
  "test-signature",
].join(".");
const userInfo = await provider.getUserInfo({ idToken });
assert.equal(userInfo?.user.email, scenario.acceptedEmail);
`;

describe("Google sign-in account restrictions", () => {
	it.each([
		{
			name: "admits personal Gmail accounts without a Workspace restriction",
			allowList: "gmail.com",
			hostedDomain: "",
			acceptedEmail: "person@gmail.com",
			rejectedEmail: "person@outlook.com",
		},
		{
			name: "preserves the hosted-domain restriction for a company",
			allowList: "example.test",
			hostedDomain: "example.test",
			acceptedEmail: "person@example.test",
			rejectedEmail: "person@gmail.com",
		},
		{
			name: "keeps individual Gmail access limited to the approved address",
			allowList: "person@gmail.com",
			hostedDomain: "",
			acceptedEmail: "person@gmail.com",
			rejectedEmail: "someone-else@gmail.com",
		},
	])("$name", (scenario) => {
		const result = Bun.spawnSync({
			cmd: [
				process.execPath,
				"--eval",
				`const scenario = ${JSON.stringify(scenario)};\n${probe}`,
			],
			cwd: resolve(import.meta.dir, ".."),
			env: {
				...process.env,
				NODE_ENV: "test",
				TEST_DATABASE_URL: "postgresql://localhost:1/google_sign_in_test",
				BETTER_AUTH_SECRET: "google-sign-in-test-secret-at-least-32-characters",
				GOOGLE_CLIENT_ID: "google-sign-in-test-client",
				GOOGLE_CLIENT_SECRET: "google-sign-in-test-client-secret",
				MICROSOFT_CLIENT_ID: "",
				MICROSOFT_CLIENT_SECRET: "",
				SLACK_CLIENT_ID: "",
				SLACK_CLIENT_SECRET: "",
				APP_URL: "https://crm.example.test",
				API_URL: "https://crm.example.test",
				ALLOWED_SIGN_IN: scenario.allowList,
			},
		});

		expect(result.stderr.toString()).toBe("");
		expect(result.exitCode).toBe(0);
	});
});
