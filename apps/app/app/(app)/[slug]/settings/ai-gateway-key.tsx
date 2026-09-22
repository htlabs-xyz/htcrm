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

export function AiGatewayKey() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const inputId = useId();
	const [draft, setDraft] = useState("");
	const key = useQuery(trpc.settings.aiGatewayKey.queryOptions());
	const save = useMutation(
		trpc.settings.setAiGatewayKey.mutationOptions({
			onSuccess: async (result) => {
				setDraft("");
				await cache.settings();
				toast.success(
					result.configured
						? "Cloudflare key saved. Choose a model below."
						: "Cloudflare key removed.",
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!key.data) return null;
	const { configured, hint, accountConfigured, needsReplacement } = key.data;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Cloudflare AI</CardTitle>
				<CardDescription>
					Enter your Cloudflare API token, then choose an AI model below.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						save.mutate({ apiKey: draft.trim() });
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={inputId}>Cloudflare API token</FieldLabel>
							<Input
								id={inputId}
								type="password"
								value={draft}
								onChange={(event) => setDraft(event.target.value)}
								placeholder={hint ?? "Paste your token"}
								autoComplete="off"
								autoCapitalize="off"
								autoCorrect="off"
								spellCheck={false}
								disabled={save.isPending || !accountConfigured}
							/>
							<FieldDescription>
								{!accountConfigured
									? "The server needs a Cloudflare account configured before you can save a token."
									: needsReplacement
										? "The saved token could not be opened. Enter it again."
										: "Use a token with Workers AI Read. Model usage is billed through your Cloudflare account. Your saved token stays hidden."}
							</FieldDescription>
						</Field>
						<Field orientation="horizontal">
							<Button
								type="submit"
								disabled={save.isPending || !draft.trim() || !accountConfigured}
							>
								{save.isPending ? <Spinner data-icon="inline-start" /> : null}
								{configured ? "Replace key" : "Save key"}
							</Button>
							{configured || needsReplacement ? (
								<Button
									type="button"
									variant="outline"
									disabled={save.isPending}
									onClick={() => save.mutate({ apiKey: null })}
								>
									Remove key
								</Button>
							) : null}
						</Field>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
