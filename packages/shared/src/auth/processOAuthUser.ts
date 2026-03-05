import type { SuiChain } from "@mysten/wallet-standard";
import type { User } from "oidc-client-ts";
import { User as UserClass } from "oidc-client-ts";
import { useNetworkStore } from "../stores/networkStore";
import { createLogger } from "../utils/logger";
import { getUserManager } from "./authConfig";
import { getZkLoginAddress } from "./getZkLoginAddress";
import { storeJwt } from "./storageService";
import { useAuthStore } from "./stores/authStore";

const log = createLogger();
const DEFAULT_TOKEN_EXPIRY_SECONDS = 3600;
const DEFAULT_AUTH_SCOPE = "openid email profile offline_access";

/**
 * Process an OIDC User after redirect or popup callback: resolve zkLogin address,
 * update user profile, persist user and JWT. Shared by CallbackScreen (redirect)
 * and authStore.loginWithPopup (popup).
 *
 * @returns The updated User with sui_address and salt in profile.
 */
export async function processOAuthUser(
  user: User,
  enokiApiKey: string,
  network?: SuiChain,
): Promise<User> {
  if (!user?.id_token) {
    throw new Error("Failed to authenticate");
  }

  const zkLoginResponse = await getZkLoginAddress({
    jwt: user.id_token,
    enokiApiKey,
  });

  if (zkLoginResponse.error) {
    throw new Error(zkLoginResponse.error.message);
  }

  if (!zkLoginResponse.data) {
    throw new Error("No zkLogin address data received");
  }

  const { salt, address } = zkLoginResponse.data;

  const updatedUser = new UserClass({
    ...user,
    profile: {
      ...user.profile,
      sui_address: address,
      salt,
    },
  });

  const userManager = getUserManager();
  await userManager.storeUser(updatedUser);
  useAuthStore.getState().setUser(updatedUser);

  const chain = network ?? useNetworkStore.getState().chain;
  await storeJwt(
    {
      id_token: user.id_token,
      access_token: user.access_token ?? "",
      token_type: user.token_type ?? "Bearer",
      expires_in: user.expires_in ?? DEFAULT_TOKEN_EXPIRY_SECONDS,
      scope: user.scope ?? DEFAULT_AUTH_SCOPE,
      refresh_token: user.refresh_token,
    },
    chain,
  );

  log.info("OAuth user processed and persisted", { chain });
  return updatedUser;
}
