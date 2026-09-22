import { AI_PROVIDER } from "@crm/db/ai-provider-config";
import { z } from "zod";

export const aiProviderConnectionInput = z.object({
	baseUrl: z.string().trim().min(1).max(2000),
	apiKey: z
		.string()
		.trim()
		.min(1)
		.max(4096)
		.regex(/^[\x21-\x7e]+$/, "Enter an API key without whitespace.")
		.optional(),
	revision: z.string().uuid().nullable(),
});

export const aiProviderInput = aiProviderConnectionInput
	.extend({
		modelId: z
			.string()
			.trim()
			.min(1)
			.max(200)
			.regex(/^[!-~]+$/),
		contextWindowTokens: z
			.number()
			.int()
			.min(1024)
			.max(AI_PROVIDER.maxContextTokens),
		maxOutputTokens: z.number().int().min(1).max(AI_PROVIDER.maxOutputTokens),
	})
	.refine((value) => value.maxOutputTokens < value.contextWindowTokens, {
		message: "Output tokens must be smaller than the context window.",
		path: ["maxOutputTokens"],
	});

export const aiProviderVerification = z.object({
	ok: z.boolean(),
	message: z.string(),
});
export type AiProviderInput = z.infer<typeof aiProviderInput>;
export type AiProviderConnectionInput = z.infer<
	typeof aiProviderConnectionInput
>;
