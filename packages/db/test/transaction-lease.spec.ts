import { describe, expect, it } from "bun:test";
import { executeCoordinatedTransaction } from "../src/transaction-lease";

describe("executeCoordinatedTransaction", () => {
	it("runs callback transactions against the client without asking D1 for an interactive transaction", async () => {
		const client = { source: "client" };
		let nativeCalls = 0;
		let callbackClient: typeof client | undefined;

		const result = await executeCoordinatedTransaction(
			client,
			async () => {
				nativeCalls += 1;
				throw new Error("D1 interactive transactions are unavailable");
			},
			[
				async (received: typeof client) => {
					callbackClient = received;
					return "finished";
				},
			],
			false,
		);

		expect(result).toBe("finished");
		expect(callbackClient).toBe(client);
		expect(nativeCalls).toBe(0);
	});

	it("keeps callback transactions native when the adapter supports them", async () => {
		const client = { source: "client" };
		const callback = async () => "finished";
		let received: unknown[] = [];

		const result = await executeCoordinatedTransaction(
			client,
			async (...arguments_) => {
				received = arguments_;
				return (arguments_[0] as typeof callback)(client);
			},
			[callback],
			true,
		);

		expect(result).toBe("finished");
		expect(received).toEqual([callback]);
	});

	it("keeps array transactions on Prisma's native batch path", async () => {
		const operations = [Promise.resolve("first"), Promise.resolve("second")];
		let received: unknown[] = [];

		const result = await executeCoordinatedTransaction(
			{},
			async (...arguments_) => {
				received = arguments_;
				return Promise.all(operations);
			},
			[operations],
			false,
		);

		expect(result).toEqual(["first", "second"]);
		expect(received).toEqual([operations]);
	});
});
