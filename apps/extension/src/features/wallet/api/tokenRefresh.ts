import { createLogger } from "@evevault/shared/utils";

const log = createLogger();

export const handleTestTokenRefresh = async (user: User) => {
  log.debug("Token refresh test", {
    hasRefreshToken: !!user?.refresh_token,
    hasIdToken: !!user?.id_token,
    hasAccessToken: !!user?.access_token,
  });

  try {
    const fusionAuthUrl = import.meta.env.VITE_FUSION_SERVER_URL;
    const tokenResponse = await fetch(`${fusionAuthUrl}/api/jwt/refresh`, {
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
    log.info("Token refreshed", await tokenResponse.json());

    // TODO: Update refreshed token in the device store
  } catch (err) {
    log.error("Token refresh error", err);
  }
};
