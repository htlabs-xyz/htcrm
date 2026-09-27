import { readFileSync } from "node:fs";

const { crons } = JSON.parse(readFileSync("apps/api/vercel.json", "utf8"));

for (const { path, schedule } of crons) {
	if (!/^\/internal\/[a-z/-]+$/.test(path)) {
		throw new Error(`Invalid internal cron path: ${path}`);
	}
	if (!/^[\d*/,-]+(?: [\d*/,-]+){4}$/.test(schedule)) {
		throw new Error(`Invalid cron schedule: ${schedule}`);
	}
	console.log(
		`${schedule} /usr/local/bin/run-cron ${path} >> /proc/1/fd/1 2>> /proc/1/fd/2`,
	);
}
