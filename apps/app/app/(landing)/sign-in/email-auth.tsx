"use client";

import { signIn, signUp } from "@crm/auth/client";
import { Button } from "@crm/ui/components/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { AuthHeading } from "@/components/auth-shell";

type Mode = "sign-in" | "sign-up";

export function EmailAuth({
	alternateMethods,
}: {
	alternateMethods?: ReactNode;
}) {
	const [mode, setMode] = useState<Mode>("sign-in");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string>();
	const nameId = useId();
	const emailId = useId();
	const passwordId = useId();
	const signingUp = mode === "sign-up";

	function switchMode() {
		setMode(signingUp ? "sign-in" : "sign-up");
		setError(undefined);
	}

	async function submit(form: HTMLFormElement) {
		const data = new FormData(form);
		const name = String(data.get("name") ?? "").trim();
		const email = String(data.get("email") ?? "").trim();
		const password = String(data.get("password") ?? "");
		const callbackURL = `${window.location.origin}/`;

		if (signingUp && !name) {
			setError("Enter your full name.");
			return;
		}

		setPending(true);
		setError(undefined);

		try {
			const result = signingUp
				? await signUp.email({
						email,
						password,
						name,
						callbackURL,
					})
				: await signIn.email({ email, password, callbackURL });

			if (result.error) {
				setError(result.error.message ?? "Could not authenticate with email.");
				return;
			}

			window.location.assign("/");
		} catch {
			setError("Could not reach the sign-in service.");
		} finally {
			setPending(false);
		}
	}

	return (
		<>
			<AuthHeading
				title={signingUp ? "Create your account" : "Welcome back"}
				description={
					signingUp
						? "Register with an allowed email address to get started."
						: "Sign in with your account to continue."
				}
			/>

			<form
				className="flex flex-col gap-6"
				onSubmit={(event) => {
					event.preventDefault();
					submit(event.currentTarget).catch(() => {
						setPending(false);
						setError("Could not reach the sign-in service.");
					});
				}}
			>
				<FieldGroup>
					{signingUp ? (
						<Field>
							<FieldLabel htmlFor={nameId}>Full name</FieldLabel>
							<Input
								id={nameId}
								name="name"
								autoComplete="name"
								autoFocus
								disabled={pending}
								required
							/>
						</Field>
					) : null}

					<Field>
						<FieldLabel htmlFor={emailId}>Email</FieldLabel>
						<Input
							id={emailId}
							name="email"
							type="email"
							autoComplete="email"
							autoCapitalize="none"
							autoCorrect="off"
							autoFocus={!signingUp}
							disabled={pending}
							required
						/>
					</Field>

					<Field>
						<FieldLabel htmlFor={passwordId}>Password</FieldLabel>
						<Input
							id={passwordId}
							name="password"
							type="password"
							autoComplete={signingUp ? "new-password" : "current-password"}
							disabled={pending}
							minLength={8}
							maxLength={128}
							required
						/>
					</Field>

					{error ? <FieldError>{error}</FieldError> : null}
				</FieldGroup>

				<Button type="submit" disabled={pending}>
					{pending ? <Spinner data-icon="inline-start" /> : null}
					{signingUp ? "Create account" : "Sign in with email"}
				</Button>
			</form>

			<p className="text-center text-muted-foreground text-xs/5">
				{signingUp ? "Already have an account?" : "New to this CRM?"}{" "}
				<button
					className="font-medium text-foreground underline underline-offset-4"
					disabled={pending}
					onClick={switchMode}
					type="button"
				>
					{signingUp ? "Sign in" : "Create an account"}
				</button>
			</p>

			{alternateMethods ? (
				<FieldGroup>
					<FieldSeparator>Or continue with</FieldSeparator>
					{alternateMethods}
				</FieldGroup>
			) : null}
		</>
	);
}
