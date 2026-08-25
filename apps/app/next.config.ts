import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRootEnv } from "@crm/env";
import type { NextConfig } from "next";

loadRootEnv();

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const { env: runtimeEnvironment } = process;
const publicApiUrl = runtimeEnvironment.NEXT_PUBLIC_API_URL ?? "/api";

const allowedDevOrigins = (runtimeEnvironment.APP_URL ?? "")
	.split(",")
	.flatMap((origin) => {
		try {
			return [new URL(origin.trim()).hostname];
		} catch {
			return [];
		}
	});

const nextConfig: NextConfig = {
	output: "standalone",
	outputFileTracingRoot: repositoryRoot,
	allowedDevOrigins,

	env: {
		NEXT_PUBLIC_API_URL: publicApiUrl,
	},

	transpilePackages: ["@crm/auth", "@crm/db", "@crm/telemetry", "@crm/ui"],

	serverExternalPackages: ["@prisma/client"],

	images: {
		remotePatterns: [
			{ protocol: "https", hostname: "**.blob.vercel-storage.com" },
		],
	},

	cacheComponents: true,
	partialPrefetching: true,
};

export default nextConfig;
