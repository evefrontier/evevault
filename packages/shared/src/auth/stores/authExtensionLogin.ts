import type { User } from 'oidc-client-ts';
import { createLogger } from '#/utils';
import {
  buildUserFromOAuthResponse,
  persistEnrichedUser,
} from './authUserSession';
import {
  type AuthGet,
  type AuthSet,
  type GetUserManagerInstance,
  getErrorMessage,
} from './authWorkflowUtils';

const log = createLogger();

export async function loginExtensionSession(
  get: AuthGet,
  set: AuthSet,
  getUserManagerInstance: GetUserManagerInstance,
): Promise<User | undefined> {
  // Keep the extension approval error silent; it represents user cancellation.
  try {
    const jwtResponse = await get().extensionLogin();

    if (!jwtResponse) {
      set({ loading: false });
      return undefined;
    }

    const user = await persistEnrichedUser(
      buildUserFromOAuthResponse(jwtResponse),
      getUserManagerInstance(),
    );

    set({ user, loading: false });
    return user;
  } catch (error) {
    log.error('Extension login failed', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage !== 'The user did not approve access.') {
      set({ error: getErrorMessage(error) });
    }

    set({ loading: false });
    return undefined;
  }
}
