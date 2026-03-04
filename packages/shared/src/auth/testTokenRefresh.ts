import { User, type UserProfile } from "oidc-client-ts";
import type { JwtResponse } from "../types";
import { createLogger } from "../utils";
import { patchUserNonce } from "./patchNonce";
import { storeJwt } from "./storageService";
import { useAuthStore } from "./stores/authStore";

const log = createLogger();

/**
 * Test helper: refreshes the OAuth tokens using the refresh_token grant.
 * Patches nonce first, calls FusionAuth /oauth2/token, stores JWT and updates auth store.
 * Used by web and extension "Token refresh test" menu actions.
 */
export async function handleTestTokenRefresh(
  user: User,
  nonce: string,
): Promise<JwtResponse> {
  log.debug("Token refresh test", {
    hasRefreshToken: !!user?.refresh_token,
    hasIdToken: !!user?.id_token,
    hasAccessToken: !!user?.access_token,
  });

  try {
    const fusionAuthUrl = import.meta.env.VITE_FUSION_SERVER_URL;
    const clientId = import.meta.env.VITE_FUSIONAUTH_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_FUSION_CLIENT_SECRET;

    if (!fusionAuthUrl?.trim()) {
      throw new Error("VITE_FUSION_SERVER_URL is not set");
    }
    if (!clientId || !clientSecret) {
      throw new Error("Client ID or client secret is not set");
    }

    log.info("Access token expiring, patching user nonce before refresh");
    await patchUserNonce(user, nonce);

    const response = await fetch(`${fusionAuthUrl}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: user?.refresh_token ?? "",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const refreshedData: JwtResponse = await response.json();
    log.info("Token refreshed", {
      expires_in: refreshedData.expires_in,
      token_type: refreshedData.token_type,
    });

    await storeJwt(refreshedData as JwtResponse);

    const currentUser = useAuthStore.getState().user;
    if (currentUser) {
      const updatedUser = new User({
        id_token: refreshedData.id_token,
        access_token: refreshedData.access_token,
        token_type: refreshedData.token_type,
        profile: currentUser.profile as UserProfile,
        expires_at: Math.floor(Date.now() / 1000) + refreshedData.expires_in,
        refresh_token: refreshedData.refresh_token,
      });

      useAuthStore.getState().setUser(updatedUser);
      log.info("Auth store user updated with refreshed tokens");
    }

    return refreshedData;
  } catch (err) {
    log.error("Token refresh error", err);
    throw err;
  }
}
