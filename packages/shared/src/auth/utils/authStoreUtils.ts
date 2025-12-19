import type { JwtResponse } from "@evevault/shared/types";

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

export const resolveExpiresAt = (jwt: JwtResponse): number => {
  if (typeof jwt.expires_at === "number") {
    return jwt.expires_at;
  }
  if (typeof jwt.expires_in === "number") {
    return Math.floor(Date.now() / 1000) + jwt.expires_in;
  }
  return Math.floor(Date.now() / 1000);
};
