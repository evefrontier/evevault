import { storeJwt, useAuthStore } from "@evevault/shared/auth";
import { patchUserNonce } from "@evevault/shared/auth/patchNonce";
import type { JwtResponse } from "@evevault/shared/types";
import { createLogger } from "@evevault/shared/utils";
import { decodeJwt } from "jose";
import { User, type UserProfile } from "oidc-client-ts";

const log = createLogger();

interface FusionAuthRefreshResponse {
  refreshToken?: string;
  refreshTokenId?: string;
  token: string;
}

export const handleTestTokenRefresh = async (user: User, nonce: string) => {
  log.debug("Token refresh test", {
    hasRefreshToken: !!user?.refresh_token,
    hasIdToken: !!user?.id_token,
    hasAccessToken: !!user?.access_token,
  });

  try {
    const fusionAuthUrl = import.meta.env.VITE_FUSION_SERVER_URL;

    //First, call the nonce update service
    log.info("Access token expiring, patching user nonce before refresh");

    // Get user from parameter or fallback to UserManager
    await patchUserNonce(user as User, nonce);

    const response = await fetch(`${fusionAuthUrl}/api/jwt/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-FusionAuth-TenantId": import.meta.env.VITE_FUSION_TENANT_ID,
      },
      body: JSON.stringify({
        refreshToken: user?.refresh_token,
        token: user?.access_token,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const refreshedData: FusionAuthRefreshResponse = await response.json();
    log.info("Token refreshed", { hasToken: !!refreshedData.token });

    // Decode the new token to get expiration
    const decodedToken = decodeJwt(refreshedData.token);
    const expiresIn = decodedToken.exp
      ? decodedToken.exp - Math.floor(Date.now() / 1000)
      : 3600;

    // Construct the new JWT response
    const newJwt: JwtResponse = {
      id_token: refreshedData.token,
      access_token: refreshedData.token,
      token_type: "Bearer",
      expires_in: expiresIn,
      scope: "openid email profile offline_access",
      refresh_token: refreshedData.refreshToken ?? user?.refresh_token,
      refresh_token_id: refreshedData.refreshTokenId,
    };
    // Store the refreshed JWT for the current network
    await storeJwt(newJwt);

    // Update the auth store user with the new tokens
    const currentUser = useAuthStore.getState().user;
    if (currentUser) {
      const updatedUser = new User({
        id_token: newJwt.id_token,
        access_token: newJwt.access_token,
        token_type: newJwt.token_type,
        scope: newJwt.scope,
        profile: currentUser.profile as UserProfile,
        expires_at: Math.floor(Date.now() / 1000) + expiresIn,
        refresh_token: newJwt.refresh_token,
      });

      useAuthStore.getState().setUser(updatedUser);
      log.info("Auth store user updated with refreshed tokens");
    }

    return newJwt;
  } catch (err) {
    log.error("Token refresh error", err);
    throw err;
  }
};
