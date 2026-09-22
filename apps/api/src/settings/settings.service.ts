import type { Db } from "@crm/db";
import {
	maskKey,
	readArchiveRetentionDays,
	readContextDevKey,
	writeArchiveRetentionDays,
	writeContextDevKey,
} from "@crm/db/settings";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ResearchKeyService } from "../agent/research-key.service";
import { BackfillService } from "../backfill/backfill.service";
import { InjectDatabase } from "../database/database.constants";
import { AiProviderService } from "./ai-provider.service";
import { ModelCatalogService } from "./model-catalog.service";
import type {
	AgentModelSettings,
	ArchiveRetentionSettings,
	ModelCatalogResult,
	ResearchKeySettings,
} from "./settings.contracts";

@Injectable()
export class SettingsService {
	private readonly logger = new Logger(SettingsService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly catalog: ModelCatalogService,
		private readonly researchKeys: ResearchKeyService,
		private readonly backfill: BackfillService,
		private readonly provider: AiProviderService,
	) {}

	async agentModel(): Promise<AgentModelSettings> {
		const [setup, row] = await Promise.all([
			this.provider.settings(),
			this.db.appSetting.findFirst({ select: { updatedAt: true } }),
		]);
		const id = setup.configured ? setup.modelId : null;
		return {
			selectedId: id,
			effectiveId: id,
			defaultId: null,
			effective: id
				? {
						id,
						name: id,
						provider: "OpenAI-compatible",
						contextWindowTokens: setup.contextWindowTokens,
						maxOutputTokens: setup.maxOutputTokens,
						pricing: null,
					}
				: null,
			updatedAt: row?.updatedAt.toISOString() ?? null,
		};
	}

	async setAgentModel(modelId: string | null): Promise<AgentModelSettings> {
		if (modelId === null)
			throw new BadRequestException(
				"There is no default gateway model. Configure or remove the provider in AI provider settings.",
			);

		const models = await this.catalog.models();

		if (!models) {
			throw new BadRequestException(
				"Could not load the model list. Enter the model manually in AI provider settings.",
			);
		}

		const chosen = models.find((model) => model.id === modelId);

		if (!chosen) {
			throw new BadRequestException(
				`The AI provider catalog does not contain a model called "${modelId}".`,
			);
		}

		const setup = await this.provider.settings();
		if (
			!setup.configured ||
			!chosen.contextWindowTokens ||
			!setup.maxOutputTokens
		)
			throw new BadRequestException(
				"Set this model and its token limits in AI provider settings.",
			);
		await this.provider.save({
			baseUrl: setup.baseUrl,
			revision: setup.revision,
			modelId: chosen.id,
			contextWindowTokens: chosen.contextWindowTokens,
			maxOutputTokens: Math.min(
				setup.maxOutputTokens,
				chosen.contextWindowTokens - 1,
			),
		});

		this.logger.log({ message: "Agent model changed", modelId: chosen.id });

		return this.agentModel();
	}

	async modelCatalog(): Promise<ModelCatalogResult> {
		const models = await this.catalog.models();
		return {
			models: models ?? [],
			available: models !== null,
			message:
				models === null
					? "Enter a model manually in AI provider settings."
					: null,
		};
	}

	async researchKey(): Promise<ResearchKeySettings> {
		const key = await readContextDevKey(this.db);

		return { configured: key !== null, hint: key ? maskKey(key) : null };
	}

	async setResearchKey(apiKey: string): Promise<ResearchKeySettings> {
		const check = await this.researchKeys.verify(apiKey);

		if (check.outcome === "invalid") {
			throw new BadRequestException(check.reason);
		}

		await writeContextDevKey(this.db, apiKey);

		this.logger.log({
			message: "Context key saved",
			verified: check.outcome === "valid",
		});

		// Every company added while there was no key is still PENDING, because a
		// brand task with nowhere to look leaves the record alone. The sign-in
		// sweep would find them, but the person who just fixed it is standing
		// here — so pick the work up now rather than on their next sign-in.
		void this.backfill
			.run("companies")
			.then(({ queued, remaining }) => {
				if (queued > 0) {
					this.logger.log({
						message: "Queued the research that was waiting on a key",
						queued,
						remaining,
					});
				}
			})
			.catch((cause: unknown) => {
				this.logger.warn(
					{ message: "Could not queue the waiting research" },
					cause instanceof Error ? cause.stack : String(cause),
				);
			});

		return this.researchKey();
	}

	async archiveRetention(): Promise<ArchiveRetentionSettings> {
		return { days: await readArchiveRetentionDays(this.db) };
	}

	async setArchiveRetention(days: number): Promise<ArchiveRetentionSettings> {
		const saved = await writeArchiveRetentionDays(this.db, days);

		this.logger.log({
			message: "Archive retention changed",
			days: saved,
		});

		return { days: saved };
	}
}
