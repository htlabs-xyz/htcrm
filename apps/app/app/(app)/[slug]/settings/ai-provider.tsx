"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

type ProviderSettings = {
	configured: boolean;
	baseUrl: string;
	revision: string | null;
	modelId: string | null;
	contextWindowTokens: number | null;
	maxOutputTokens: number | null;
	needsReplacement: boolean;
};

export function AiProvider() {
	const trpc = useTRPC();
	const settings = useQuery(trpc.settings.aiProvider.queryOptions());
	if (settings.isError)
		return <p>AI settings could not be loaded. Reload this page.</p>;
	if (!settings.data) return <Spinner />;
	return (
		<ProviderForm
			key={settings.data.revision ?? "unconfigured"}
			settings={settings.data}
		/>
	);
}

function ProviderForm({ settings }: { settings: ProviderSettings }) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const id = useId();
	const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
	const [apiKey, setApiKey] = useState("");
	const [modelId, setModelId] = useState(settings.modelId ?? "");
	const [contextTokens, setContextTokens] = useState(
		settings.contextWindowTokens?.toString() ?? "",
	);
	const [outputTokens, setOutputTokens] = useState(
		settings.maxOutputTokens?.toString() ?? "",
	);
	const catalog = useMutation(
		trpc.settings.providerModels.mutationOptions({
			onError: (error) => toast.error(error.message),
		}),
	);
	const save = useMutation(
		trpc.settings.setAiProvider.mutationOptions({
			onSuccess: async () => {
				setApiKey("");
				await cache.settings();
				toast.success(
					"AI provider verified and saved. New sessions use this model.",
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const remove = useMutation(
		trpc.settings.removeAiProvider.mutationOptions({
			onSuccess: async () => {
				setApiKey("");
				await cache.settings();
				toast.success("AI provider removed.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const pending = save.isPending || remove.isPending || catalog.isPending;
	const connection = () => ({
		baseUrl: baseUrl.trim(),
		apiKey: apiKey.trim() || undefined,
		revision: settings.revision,
	});
	const selectModel = (value: string) => {
		setModelId(value);
		const model = catalog.data?.models.find((entry) => entry.id === value);
		if (value !== modelId) {
			setContextTokens(model?.contextWindowTokens?.toString() ?? "");
			setOutputTokens(model?.maxOutputTokens?.toString() ?? "");
		}
	};
	return (
		<Card>
			<CardHeader>
				<CardTitle>AI provider</CardTitle>
				<CardDescription>
					Use an OpenAI-compatible API for the CRM. This configuration is shared
					across the workspace.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						save.mutate({
							...connection(),
							modelId: modelId.trim(),
							contextWindowTokens: Number(contextTokens),
							maxOutputTokens: Number(outputTokens),
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={`${id}-endpoint`}>API endpoint</FieldLabel>
							<Input
								id={`${id}-endpoint`}
								type="url"
								required
								value={baseUrl}
								disabled={pending}
								placeholder="https://api.provider.com/v1"
								onChange={(event) => {
									setBaseUrl(event.target.value);
									setApiKey("");
									setModelId("");
									setContextTokens("");
									setOutputTokens("");
									catalog.reset();
								}}
							/>
							<FieldDescription>
								Enter the public HTTPS base URL. Include /v1 only when the
								provider requires it. Omit /chat/completions.
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor={`${id}-key`}>API key</FieldLabel>
							<Input
								id={`${id}-key`}
								type="password"
								autoComplete="off"
								autoCapitalize="off"
								autoCorrect="off"
								spellCheck={false}
								value={apiKey}
								disabled={pending}
								placeholder={
									settings.configured
										? "Leave blank to keep the saved key"
										: "Enter your provider API key"
								}
								onChange={(event) => {
									setApiKey(event.target.value);
									catalog.reset();
								}}
							/>
							<FieldDescription>
								{settings.needsReplacement
									? "The saved key could not be opened. Enter it again."
									: "The key stays encrypted on the server. Changing the endpoint requires a key for the new endpoint."}
							</FieldDescription>
						</Field>
						<Field orientation="horizontal">
							<Button
								type="button"
								variant="outline"
								disabled={pending || !baseUrl.trim()}
								onClick={() => catalog.mutate(connection())}
							>
								{catalog.isPending ? (
									<Spinner data-icon="inline-start" />
								) : null}
								Load models
							</Button>
						</Field>
						{catalog.data?.message ? (
							<p role="status">{catalog.data.message}</p>
						) : null}
						<Field>
							<FieldLabel htmlFor={`${id}-model`}>Model ID</FieldLabel>
							<Input
								id={`${id}-model`}
								list={`${id}-models`}
								required
								value={modelId}
								disabled={pending}
								placeholder="Enter or choose a model ID"
								onChange={(event) => selectModel(event.target.value)}
							/>
							<datalist id={`${id}-models`}>
								{catalog.data?.models.map((model) => (
									<option key={model.id} value={model.id}>
										{model.name}
									</option>
								))}
							</datalist>
							<FieldDescription>
								Choose a loaded model or enter its exact ID. A model list is
								optional.
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor={`${id}-context`}>
								Context window (tokens)
							</FieldLabel>
							<Input
								id={`${id}-context`}
								type="number"
								required
								value={contextTokens}
								disabled={pending}
								onChange={(event) => setContextTokens(event.target.value)}
							/>
							<FieldDescription>
								Use the provider&apos;s documented context limit, including
								space for the response.
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor={`${id}-output`}>
								Maximum response tokens
							</FieldLabel>
							<Input
								id={`${id}-output`}
								type="number"
								required
								value={outputTokens}
								disabled={pending}
								onChange={(event) => setOutputTokens(event.target.value)}
							/>
							<FieldDescription>
								Set a response budget below the context window and within the
								model&apos;s output limit.
							</FieldDescription>
						</Field>
						<Field orientation="horizontal">
							<Button type="submit" disabled={pending || !modelId.trim()}>
								{save.isPending ? <Spinner data-icon="inline-start" /> : null}
								Save and test
							</Button>
							{settings.configured || settings.needsReplacement ? (
								<Button
									type="button"
									variant="outline"
									disabled={pending}
									onClick={() => remove.mutate({ revision: settings.revision })}
								>
									Remove provider
								</Button>
							) : null}
						</Field>
						<FieldDescription>
							The test uses a small amount of provider credit to check streaming
							and tool calling. A failed test keeps the saved configuration.
						</FieldDescription>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
