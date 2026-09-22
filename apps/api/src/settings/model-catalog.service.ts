import { createHash } from "node:crypto";
import { fetchGatewayCatalog, type GatewayModel } from "@crm/ai-gateway";
import {
	AI_GATEWAY,
	gatewayAccountId,
	gatewayId,
} from "@crm/ai-gateway/config";
import type { Db } from "@crm/db";
import { readGatewayKey } from "@crm/db/ai-gateway-key";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Cache } from "cache-manager";
import { InjectDatabase } from "../database/database.constants";

export type CatalogModel = GatewayModel;

@Injectable()
export class ModelCatalogService {
	private readonly logger = new Logger(ModelCatalogService.name);

	constructor(
		@Inject(CACHE_MANAGER) private readonly cache: Cache,
		@InjectDatabase() private readonly db: Db,
	) {}

	async models(): Promise<CatalogModel[] | null> {
		const accountId = gatewayAccountId();
		const gatewayName = gatewayId();
		if (!accountId || !gatewayName) return null;
		try {
			const token = await readGatewayKey(this.db);
			if (!token) return null;
			const fingerprint = createHash("sha256").update(token).digest("hex");
			const key = `settings:cloudflare-byok-models:${accountId}:${gatewayName}:${fingerprint}`;
			const cached = await this.cache.get<CatalogModel[]>(key);
			if (cached) return cached;
			const models = await fetchGatewayCatalog(accountId, token);
			await this.cache.set(key, models, AI_GATEWAY.catalogTtlMs);
			return models;
		} catch {
			this.logger.warn("Cloudflare model catalog is unavailable");
			return null;
		}
	}

	async find(id: string): Promise<CatalogModel | null> {
		const models = await this.models();
		return models?.find((model) => model.id === id) ?? null;
	}
}
