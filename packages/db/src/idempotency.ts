import type { Prisma } from "./generated/prisma/client";

export async function lockIdempotencyKey(
	tx: Prisma.TransactionClient,
	key: string,
): Promise<void> {
	void tx;
	void key;
}
