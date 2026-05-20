import type { UserManager } from "oidc-client-ts";
import type { AuthState } from "#/auth/types";
import { isBrowser } from "#/utils";

/*
 * The Zustand store owns UI state updates, while workflow modules own auth
 * behavior. These function types keep workflows testable without importing the
 * store singleton and creating initialization cycles.
 */
export type AuthSet = (partial: Partial<AuthState>) => void;
export type AuthGet = () => AuthState;
export type GetUserManagerInstance = () => UserManager;

export const getEnokiApiKey = (): string => {
  if (isBrowser()) {
    return import.meta.env.VITE_ENOKI_API_KEY ?? "";
  }
  // biome-ignore lint/suspicious/noExplicitAny: Node.js process.env access requires any type
  return (globalThis as any)?.process?.env?.VITE_ENOKI_API_KEY ?? "";
};

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
