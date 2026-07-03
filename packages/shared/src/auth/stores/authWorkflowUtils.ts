import type { UserManager } from 'oidc-client-ts'
import type { AuthState } from '#/auth/types'

/*
 * The Zustand store owns UI state updates, while workflow modules own auth
 * behavior. These function types keep workflows testable without importing the
 * store singleton and creating initialization cycles.
 */
export type AuthSet = (partial: Partial<AuthState>) => void
export type AuthGet = () => AuthState
export type GetUserManagerInstance = () => UserManager

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}
