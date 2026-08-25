import type { Db } from "@crm/db";
import { Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";

@Injectable()
export class TrackingRollupService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async run(before: Date): Promise<number> {
		const rolled = await this.db.$executeRaw`
			INSERT INTO "trackedPageDaily" ("day", "host", "path", "views", "visitors")
			SELECT
				strftime('%Y-%m-%dT00:00:00.000Z', "occurredAt") AS "day",
				"host",
				"path",
				count(*) AS "views",
				count(DISTINCT "visitorId") AS "visitors"
			FROM "trackedEvent"
			WHERE "occurredAt" < ${before} AND "type" = 'page_view'
			GROUP BY 1, 2, 3
			ON CONFLICT ("day", "host", "path") DO UPDATE
			SET "views" = MAX("trackedPageDaily"."views", EXCLUDED."views"),
				"visitors" = MAX("trackedPageDaily"."visitors", EXCLUDED."visitors");
		`;

		return rolled;
	}
}
