import "@crm/env/load";

import { PrismaD1 } from "@prisma/adapter-d1";
import { type Prisma, PrismaClient } from "./generated/prisma/client";
import { findLocalD1Database } from "./local-d1";
import {
	executeCoordinatedTransaction,
	type TransactionArguments,
	type TransactionExecutor,
} from "./transaction-lease";

const runtimeEnvironment = process["env"];
const runningTests = runtimeEnvironment.NODE_ENV === "test";
const production = runtimeEnvironment.NODE_ENV === "production";
const nextProductionBuild =
	runtimeEnvironment.NEXT_PHASE === "phase-production-build";
const cloudflareToken =
	runtimeEnvironment.CLOUDFLARE_D1_TOKEN?.trim() ||
	runtimeEnvironment.CLOUDFLARE_TOKEN?.trim();
const hasRemoteCredentials = Boolean(
	runtimeEnvironment.CLOUDFLARE_ACCOUNT_ID &&
		cloudflareToken &&
		runtimeEnvironment.CLOUDFLARE_DATABASE_ID,
);
const localDatabase = localDatabasePath();
const adapter = localDatabase
	? new (await import("@prisma/adapter-libsql")).PrismaLibSql({
			url: `file:${localDatabase}`,
		})
	: new PrismaD1(d1Credentials());

function d1Credentials() {
	const accountId = required("CLOUDFLARE_ACCOUNT_ID");
	const token = cloudflareToken ?? required("CLOUDFLARE_D1_TOKEN");
	const databaseId = required("CLOUDFLARE_DATABASE_ID");

	return {
		CLOUDFLARE_ACCOUNT_ID: accountId,
		CLOUDFLARE_D1_TOKEN: token,
		CLOUDFLARE_DATABASE_ID: databaseId,
	};
}

function localDatabasePath(): string | null {
	const explicit = runtimeEnvironment.D1_LOCAL_DATABASE_PATH?.trim() || null;
	if (production && !nextProductionBuild) {
		if (explicit) {
			throw new Error("D1_LOCAL_DATABASE_PATH cannot be used in production.");
		}
		return null;
	}

	if (!runningTests) {
		return explicit ?? (hasRemoteCredentials ? null : findLocalD1Database());
	}

	const testDatabase = explicit ?? findLocalD1Database();
	if (testDatabase) return testDatabase;
	throw new Error(
		"Tests require a local D1 database. Run bun run db:test before the test suite.",
	);
}

function required(name: string): string {
	const value = runtimeEnvironment[name];
	if (value) return value;

	throw new Error(
		`${name} is not set. Add it to the root environment file before using @crm/db.`,
	);
}

export interface PrismaLogRecord {
	level: Prisma.LogLevel;
	message: string;
	target: string;
	durationMs?: number;
}

export type PrismaLogSink = (record: PrismaLogRecord) => void;

const consoleSink: PrismaLogSink = ({ level, message, target, durationMs }) => {
	const suffix = durationMs === undefined ? "" : ` (+${durationMs}ms)`;
	const line = `[prisma:${level}] ${message}${suffix} [${target}]`;

	if (level === "error") {
		console.error(line);
	} else if (level === "warn") {
		console.warn(line);
	} else {
		console.log(line);
	}
};

let sink: PrismaLogSink = consoleSink;

export function setPrismaLogSink(next: PrismaLogSink | null): void {
	sink = next ?? consoleSink;
}

const logQueries = runtimeEnvironment.PRISMA_LOG_QUERIES === "true";

const logDefinitions: Prisma.LogDefinition[] = [
	{ level: "warn", emit: "event" },
	{ level: "error", emit: "event" },
	...(logQueries
		? ([
				{ level: "query", emit: "event" },
				{ level: "info", emit: "event" },
			] satisfies Prisma.LogDefinition[])
		: []),
];

const createPrismaClient = () => {
	const client = new PrismaClient({
		adapter,
		log: logDefinitions,
	});

	client.$on("error", ({ message, target }) => {
		sink({ level: "error", message, target });
	});
	client.$on("warn", ({ message, target }) => {
		sink({ level: "warn", message, target });
	});
	client.$on("info", ({ message, target }) => {
		sink({ level: "info", message, target });
	});
	client.$on("query", ({ query, duration, target }) => {
		sink({ level: "query", message: query, target, durationMs: duration });
	});

	const transaction = client.$transaction.bind(client) as TransactionExecutor<
		typeof client
	>;
	return new Proxy(client, {
		get(target, property, receiver) {
			if (property !== "$transaction") {
				return Reflect.get(target, property, receiver);
			}

			return (...arguments_: TransactionArguments<typeof client>) =>
				executeCoordinatedTransaction(
					client,
					transaction,
					arguments_,
					localDatabase !== null,
				);
		},
	}) as typeof client;
};

declare global {
	var prisma: ReturnType<typeof createPrismaClient> | undefined;
}

export const db = globalThis.prisma ?? createPrismaClient();

if (runtimeEnvironment.NODE_ENV !== "production") {
	globalThis.prisma = db;
}

export type Db = typeof db;
