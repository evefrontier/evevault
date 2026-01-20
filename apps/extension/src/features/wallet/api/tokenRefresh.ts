import { storeJwt, useAuthStore } from "@evevault/shared/auth";
import { patchUserNonce } from "@evevault/shared/auth/patchNonce";
import type { JwtResponse } from "@evevault/shared/types";
import { createLogger } from "@evevault/shared/utils";
import { decodeJwt } from "jose";
import { User, type UserProfile } from "oidc-client-ts";

const log = createLogger();

export const handleTestTokenRefresh = async (user: User, nonce: string) => {
  log.debug("Token refresh test", {
    hasRefreshToken: !!user?.refresh_token,
    hasIdToken: !!user?.id_token,
    hasAccessToken: !!user?.access_token,
  });

  try {
    const fusionAuthUrl = import.meta.env.VITE_FUSION_SERVER_URL;
    const clientId = import.meta.env.VITE_FUSIONAUTH_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_FUSION_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Client ID or client secret is not set");
    }

    //First, call the nonce update service
    log.info("Access token expiring, patching user nonce before refresh");

    // Get user from parameter or fallback to UserManager
    await patchUserNonce(user as User, nonce);

    log.info("refresh_token value:", user?.refresh_token);
    log.info("client_id value:", clientId);
    log.info("client_secret value:", clientSecret);
    log.info("fusionAuthUrl value:", fusionAuthUrl);

    const response = await fetch(`${fusionAuthUrl}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: user?.refresh_token ?? "",
        client_id: import.meta.env.VITE_FUSIONAUTH_CLIENT_ID,
        client_secret: import.meta.env.VITE_FUSION_CLIENT_SECRET,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const refreshedData: JwtResponse = await response.json();
    log.info("Token refreshed", refreshedData);

    // // Store the refreshed JWT for the current network
    await storeJwt(refreshedData as JwtResponse);

    // Update the auth store user with the new tokens
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
};
