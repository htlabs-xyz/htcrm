import dns from "node:dns/promises";
import https from "node:https";
import net from "node:net";
import { Readable } from "node:stream";
import { AI_PROVIDER } from "./ai-provider-config";
import { isBlockedAddress } from "./safe-fetch";

export function providerBaseUrl(value: string): string {
	let url: URL;
	try {
		url = new URL(value.trim());
	} catch {
		throw new Error("Enter a valid HTTPS API base URL.");
	}
	if (
		url.protocol !== "https:" ||
		url.username ||
		url.password ||
		url.search ||
		url.hash ||
		/\/(chat\/completions|responses|messages|models)\/?$/.test(url.pathname)
	)
		throw new Error(
			"Use the HTTPS API base URL without credentials, query parameters, or a model endpoint.",
		);
	const host = url.hostname.replace(/^\[|\]$/g, "");
	if (
		host === "localhost" ||
		host.endsWith(".localhost") ||
		(net.isIP(host) && isBlockedAddress(host))
	)
		throw new Error("The AI provider must use a public HTTPS address.");
	return url.toString().replace(/\/+$/, "");
}

export async function providerAddress(
	host: string,
	lookup = dns.lookup,
): Promise<string> {
	const literal = host.replace(/^\[|\]$/g, "");
	const addresses = net.isIP(literal)
		? [{ address: literal, family: net.isIP(literal) }]
		: await lookup(literal, { all: true });
	const address = addresses[0]?.address;
	if (!address || addresses.some(({ address }) => isBlockedAddress(address)))
		throw new Error("The AI provider must resolve to public IP addresses.");
	return address;
}

export function providerError(status: number): string {
	if (status === 401 || status === 403)
		return "The AI provider refused access. Check the API key and model permissions.";
	if (status === 402) return "The AI provider has insufficient credits.";
	if (status === 404)
		return "The AI provider could not find this endpoint or model.";
	if (status === 429)
		return "The AI provider rate limit was reached. Try again later.";
	return `The AI provider request failed (HTTP ${status}). Check the endpoint and model.`;
}

export async function providerRequest(
	baseUrl: string,
	apiKey: string,
	path: "models" | "chat/completions",
	init: { body?: string; signal?: AbortSignal | null; timeoutMs?: number } = {},
): Promise<Response> {
	const url = new URL(`${providerBaseUrl(baseUrl)}/${path}`);
	const signal = AbortSignal.any([
		AbortSignal.timeout(init.timeoutMs ?? AI_PROVIDER.requestTimeoutMs),
		...(init.signal ? [init.signal] : []),
	]);
	if (init.body && Buffer.byteLength(init.body) > AI_PROVIDER.maxRequestBytes)
		throw new Error("The AI request is too large. Start a new session.");
	let cancelLookup: (() => void) | undefined;
	let address: string;
	try {
		address = await Promise.race([
			providerAddress(url.hostname),
			new Promise<never>((_, reject) => {
				cancelLookup = () =>
					reject(
						new Error("The AI provider request was cancelled or timed out."),
					);
				if (signal.aborted) cancelLookup();
				else signal.addEventListener("abort", cancelLookup, { once: true });
			}),
		]);
	} finally {
		if (cancelLookup) signal.removeEventListener("abort", cancelLookup);
	}
	return new Promise((resolve, reject) => {
		const request = https.request(
			{
				hostname: address,
				port: url.port || 443,
				servername: net.isIP(url.hostname.replace(/^\[|\]$/g, ""))
					? undefined
					: url.hostname,
				path: url.pathname,
				method: init.body === undefined ? "GET" : "POST",
				agent: false,
				signal,
				headers: {
					host: url.host,
					authorization: `Bearer ${apiKey}`,
					accept: "application/json, text/event-stream",
					"content-type": "application/json",
					"accept-encoding": "identity",
				},
			},
			(response) => {
				const status = response.statusCode ?? 502;
				if (status < 200 || status >= 300) {
					response.destroy();
					resolve(
						Response.json(
							{ error: { message: providerError(status) } },
							{ status },
						),
					);
					return;
				}
				if (status === 204 || status === 205) {
					response.destroy();
					resolve(new Response(null, { status }));
					return;
				}
				const headers = new Headers();
				const contentType = response.headers["content-type"];
				if (contentType) headers.set("content-type", contentType);
				const body = Readable.toWeb(response) as ReadableStream<Uint8Array>;
				resolve(new Response(body, { status, headers }));
			},
		);
		request.on("error", () =>
			reject(
				new Error(
					"Could not connect to the AI provider. Check its address, TLS certificate, and availability.",
				),
			),
		);
		request.end(init.body);
	});
}

export async function providerJson(response: Response): Promise<unknown> {
	const reader = response.body?.getReader();
	if (!reader) throw new Error("The AI provider returned an empty response.");
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > AI_PROVIDER.maxCatalogBytes)
				throw new Error("The AI model catalog is too large.");
			chunks.push(value);
		}
		return JSON.parse(Buffer.concat(chunks).toString("utf8"));
	} finally {
		await reader.cancel().catch(() => undefined);
		reader.releaseLock();
	}
}
