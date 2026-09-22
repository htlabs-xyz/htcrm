import type { GatewayModel } from "./catalog";

export const DEEPSEEK_MODELS: GatewayModel[] = [
	{
		id: "deepseek/deepseek-flash",
		name: "DeepSeek V4.1 Flash",
		provider: "deepseek",
		contextWindowTokens: 1048576,
		maxOutputTokens: 393216,
		requestFormat: "chat-completions",
		pricing: null,
	},
	{
		id: "deepseek/deepseek-v4-pro",
		name: "DeepSeek V4 Pro",
		provider: "deepseek",
		contextWindowTokens: 1048576,
		maxOutputTokens: 393216,
		requestFormat: "chat-completions",
		pricing: null,
	},
];
