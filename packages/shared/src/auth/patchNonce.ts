import { createLogger } from "@evevault/shared/utils";
import type { User } from "oidc-client-ts";

const log = createLogger();

export const patchUserNonce = async (user: User, nonce: string | null) => {
  log.info("Patch user nonce test", {
    user,
    nonce,
  });

  if (!user?.id_token) {
    log.error("No user token available for patch user nonce");
    return;
  }

  if (!user?.profile?.sub) {
    log.error("No user profile sub available for patch user nonce");
    return;
  }

  if (!nonce) {
    log.error("No nonce available for patch user nonce");
    return;
  }

  const serviceUrl =
    import.meta.env.VITE_NONCE_PATCH_SERVICE_URL || "http://localhost:3002";

  try {
    log.info("Patching user nonce", {
      registrationId: user.profile.sub,
      nonce,
    });

    const response = await fetch(`${serviceUrl}/patch-user-nonce`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id_token: user.id_token,
        registrationId: user.profile.sub,
        nonce,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`,
      );
    }

    const result = await response.json();
    log.info("User nonce patched successfully", result);
  } catch (err) {
    log.error("Failed to patch user nonce", err);
  }
};
