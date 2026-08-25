const { env: runtimeEnvironment } = process;

export const API_URL =
	runtimeEnvironment.API_URL ??
	runtimeEnvironment.NEXT_PUBLIC_API_URL ??
	"http://localhost:3001";

export function isMarketing(): boolean {
	return runtimeEnvironment.IS_MARKETING === "true";
}
