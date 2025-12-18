import type { TokenResponse } from "@evevault/shared/types";

export const isErrorWithMessage = (
  error: unknown,
): error is { message: string } => {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  );
};

export const resolveExpiresAt = (token: TokenResponse): number => {
  if (typeof token.expires_at === "number") {
    return token.expires_at;
  }
  if (typeof token.expires_in === "number") {
    return Math.floor(Date.now() / 1000) + token.expires_in;
  }
  return Math.floor(Date.now() / 1000);
};
