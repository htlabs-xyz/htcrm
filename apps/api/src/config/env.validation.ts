import { plainToInstance, Type } from "class-transformer";
import {
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	IsUrl,
	Max,
	Min,
	MinLength,
	validateSync,
} from "class-validator";

export enum NodeEnv {
	Development = "development",
	Production = "production",
	Test = "test",
}

export class EnvironmentVariables {
	@IsEnum(NodeEnv)
	NODE_ENV: NodeEnv = NodeEnv.Development;

	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(65535)
	PORT = 3001;

	@IsOptional()
	@IsString()
	CLOUDFLARE_ACCOUNT_ID?: string;

	@IsOptional()
	@IsString()
	CLOUDFLARE_D1_TOKEN?: string;

	@IsOptional()
	@IsString()
	CLOUDFLARE_TOKEN?: string;

	@IsOptional()
	@IsString()
	CLOUDFLARE_DATABASE_ID?: string;

	@IsOptional()
	@IsString()
	D1_LOCAL_DATABASE_PATH?: string;

	@IsOptional()
	@IsUrl({ require_tld: false, require_protocol: true })
	D1_COORDINATOR_URL?: string;

	@IsOptional()
	@IsString()
	@MinLength(32, {
		message: "D1_COORDINATOR_SECRET must be at least 32 characters.",
	})
	D1_COORDINATOR_SECRET?: string;

	@IsString()
	@MinLength(32, {
		message:
			"BETTER_AUTH_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 32",
	})
	BETTER_AUTH_SECRET!: string;

	@IsString()
	@MinLength(1, {
		message:
			'ALLOWED_SIGN_IN is required — it is the only thing deciding who can sign in. Set it to your email domain, e.g. ALLOWED_SIGN_IN="acme.com", or to a single address for a one-person install.',
	})
	ALLOWED_SIGN_IN!: string;

	@IsOptional()
	@IsString()
	GOOGLE_CLIENT_ID?: string;

	@IsOptional()
	@IsString()
	GOOGLE_CLIENT_SECRET?: string;

	@IsOptional()
	@IsString()
	MICROSOFT_CLIENT_ID?: string;

	@IsOptional()
	@IsString()
	MICROSOFT_CLIENT_SECRET?: string;

	@IsOptional()
	@IsString()
	MICROSOFT_TENANT_ID?: string;

	@IsOptional()
	@IsString()
	SLACK_CLIENT_ID?: string;

	@IsOptional()
	@IsString()
	SLACK_CLIENT_SECRET?: string;

	@IsOptional()
	@IsUrl({ require_tld: false })
	API_URL?: string;

	@IsOptional()
	@IsString()
	APP_URL?: string;

	@IsOptional()
	@IsString()
	AUTH_COOKIE_DOMAIN?: string;

	@IsOptional()
	@IsString()
	REDIS_URL?: string;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	CACHE_TTL_MS?: number;

	@IsOptional()
	@IsString()
	@MinLength(16, {
		message: "CRON_SECRET must be at least 16 characters.",
	})
	CRON_SECRET?: string;

	@IsOptional()
	@IsString()
	BLOB_READ_WRITE_TOKEN?: string;

	@IsOptional()
	@IsUrl(
		{ require_tld: false, require_protocol: true },
		{
			message:
				"AGENT_URL must be a full URL with a scheme, like http://127.0.0.1:2000.",
		},
	)
	AGENT_URL?: string;

	@IsOptional()
	@IsString()
	AGENT_BRIDGE_SECRET?: string;

	@IsOptional()
	@IsString()
	CRM_TELEMETRY_DISABLED?: string;
}

export type RawEnvironment = Record<string, string | undefined>;

export function validateEnv(config: RawEnvironment): EnvironmentVariables {
	const validated = plainToInstance(EnvironmentVariables, config, {
		enableImplicitConversion: true,
		exposeDefaultValues: true,
	});

	const errors = validateSync(validated, {
		skipMissingProperties: false,
		whitelist: false,
	});

	if (errors.length > 0) {
		const details = errors
			.map((error) => Object.values(error.constraints ?? {}).join(", "))
			.join("\n  - ");

		throw new Error(
			`Invalid environment configuration:\n  - ${details}\n\nSee .env.example at the root of the repo.`,
		);
	}

	const cloudflareToken =
		validated.CLOUDFLARE_D1_TOKEN?.trim() || validated.CLOUDFLARE_TOKEN?.trim();
	const d1Values = [
		validated.CLOUDFLARE_ACCOUNT_ID,
		cloudflareToken,
		validated.CLOUDFLARE_DATABASE_ID,
	];
	const configuredD1Values = d1Values.filter(Boolean).length;
	if (configuredD1Values > 0 && configuredD1Values < d1Values.length) {
		throw new Error(
			"CLOUDFLARE_ACCOUNT_ID, a Cloudflare token, and CLOUDFLARE_DATABASE_ID must be set together.",
		);
	}
	if (
		validated.NODE_ENV === NodeEnv.Production &&
		configuredD1Values !== d1Values.length
	) {
		throw new Error("Cloudflare D1 credentials are required in production.");
	}
	if (
		validated.NODE_ENV === NodeEnv.Production &&
		validated.D1_LOCAL_DATABASE_PATH?.trim()
	) {
		throw new Error("D1_LOCAL_DATABASE_PATH cannot be used in production.");
	}

	const coordinatorValues = [
		validated.D1_COORDINATOR_URL,
		validated.D1_COORDINATOR_SECRET,
	];
	const configuredCoordinatorValues = coordinatorValues.filter(Boolean).length;
	if (
		configuredCoordinatorValues > 0 &&
		configuredCoordinatorValues < coordinatorValues.length
	) {
		throw new Error(
			"D1_COORDINATOR_URL and D1_COORDINATOR_SECRET must be set together.",
		);
	}
	if (
		validated.NODE_ENV === NodeEnv.Production &&
		configuredCoordinatorValues !== coordinatorValues.length
	) {
		throw new Error(
			"The D1 transaction coordinator is required in production.",
		);
	}

	return validated;
}
