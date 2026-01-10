// TODO(dev-auth): Remove this helper once local FusionAuth callbacks work.

import {
  getEnokiApiKey,
  getUserManager,
  getZkLoginAddress,
} from "@evevault/shared/auth";
import { useNetworkStore } from "@evevault/shared/stores";
import { createLogger } from "@evevault/shared/utils";
import {
  SUI_DEVNET_CHAIN,
  SUI_TESTNET_CHAIN,
  type SuiChain,
} from "@mysten/wallet-standard";
import { decodeJwt } from "jose";
import { type IdTokenClaims, User } from "oidc-client-ts";

const log = createLogger();

const JWT_STORAGE_KEY = "evevault:jwt";

type EvevaultToken = {
  access_token: string;
  id_token: string;
  token_type: string;
  scope: string;
  expires_in?: number;
  expires_at?: number;
} & Record<string, unknown>;

type JwtStorageMap = Record<SuiChain, EvevaultToken>;

/** Raw input can be:
 * - A JSON string
 * - A single token object
 * - An object with "evevault:jwt" containing either a single token or multi-network map
 */
type RawTokenInput =
  | string
  | EvevaultToken
  | {
      "evevault:jwt"?: EvevaultToken | Partial<JwtStorageMap>;
      [key: string]: unknown;
    };

interface SeedOptions {
  /** Target network to seed. Defaults to current network or devnet */
  network?: SuiChain;
}

interface DevWindow extends Window {
  seedEvevaultAuth?: (
    input: RawTokenInput,
    options?: SeedOptions,
  ) => Promise<void>;
  /** List available networks for seeding */
  listNetworks?: () => void;
}

/** Check if an object looks like a single token vs a network map */
const isSingleToken = (obj: unknown): obj is EvevaultToken => {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "access_token" in obj &&
    "id_token" in obj
  );
};

/** Check if an object looks like a multi-network token map */
const isNetworkMap = (obj: unknown): obj is Partial<JwtStorageMap> => {
  if (typeof obj !== "object" || obj === null) return false;
  const keys = Object.keys(obj);
  // Check if keys look like SuiChain values (e.g., "sui:devnet", "sui:testnet")
  return keys.some((key) => key.startsWith("sui:"));
};

const getExistingTokens = (): Partial<JwtStorageMap> | null => {
  const stored = window.localStorage.getItem(JWT_STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as Partial<JwtStorageMap>;
  } catch {
    return null;
  }
};

const storeTokens = (tokens: Partial<JwtStorageMap>): void => {
  window.localStorage.setItem(JWT_STORAGE_KEY, JSON.stringify(tokens));
};

const resolveToken = (
  input: RawTokenInput,
  targetNetwork: SuiChain,
): EvevaultToken => {
  // Parse if string
  const normalized =
    typeof input === "string" ? JSON.parse(input) : (input as RawTokenInput);

  // Check if it's an object with evevault:jwt key
  const jwtValue =
    typeof normalized === "object" && normalized !== null
      ? (
          normalized as {
            "evevault:jwt"?: EvevaultToken | Partial<JwtStorageMap>;
          }
        )["evevault:jwt"]
      : undefined;

  let tokenCandidate: EvevaultToken | undefined;

  if (jwtValue) {
    if (isNetworkMap(jwtValue)) {
      // Multi-network map from extension - extract token for target network
      tokenCandidate = jwtValue[targetNetwork];
      if (!tokenCandidate) {
        // If no token for target network, try to get any available token
        const availableNetworks = Object.keys(jwtValue) as SuiChain[];
        if (availableNetworks.length > 0) {
          tokenCandidate = jwtValue[availableNetworks[0]];
          log.warn(
            `[dev-auth] No token for ${targetNetwork}, using token from ${availableNetworks[0]}`,
          );
        }
      }
    } else if (isSingleToken(jwtValue)) {
      // Single token object
      tokenCandidate = jwtValue;
    }
  } else if (isSingleToken(normalized)) {
    // Direct token object
    tokenCandidate = normalized;
  }

  if (!tokenCandidate) {
    throw new Error(
      "Input does not contain a valid evevault:jwt token. Expected either:\n" +
        "  - A single token object with access_token and id_token\n" +
        '  - A network map like { "sui:devnet": { access_token, id_token, ... } }',
    );
  }

  // Merge with existing tokens (preserve other networks)
  const existingTokens = getExistingTokens() ?? {};
  const updatedTokens: Partial<JwtStorageMap> = {
    ...existingTokens,
    [targetNetwork]: tokenCandidate,
  };

  storeTokens(updatedTokens);
  log.info(`[dev-auth] Stored JWT for ${targetNetwork}`);

  return tokenCandidate;
};

const getExpiresAt = (token: EvevaultToken) => {
  if (typeof token.expires_at === "number") {
    return token.expires_at;
  }
  if (typeof token.expires_in === "number") {
    return Math.floor(Date.now() / 1000) + token.expires_in;
  }
  return Math.floor(Date.now() / 1000) + 3600;
};

const buildPersistedUser = async (token: EvevaultToken) => {
  const { data, error } = await getZkLoginAddress({
    jwt: token.id_token,
    enokiApiKey: getEnokiApiKey(),
  });

  if (error || !data) {
    throw new Error(
      error?.message ?? "Failed to fetch zkLogin address/salt for token",
    );
  }

  const claims = decodeJwt(token.id_token) as IdTokenClaims;

  return {
    id_token: token.id_token,
    access_token: token.access_token,
    token_type: token.token_type,
    scope: token.scope,
    expires_at: getExpiresAt(token),
    profile: {
      ...claims,
      sui_address: data.address,
      salt: data.salt,
    },
  };
};

type PersistedUser = Awaited<ReturnType<typeof buildPersistedUser>>;

const persistAuthState = (user: PersistedUser) => {
  const payload = {
    state: {
      user,
      loading: false,
      error: null,
    },
    version: 0,
  };
  localStorage.setItem("evevault:auth", JSON.stringify(payload));
};

const storeUserInOidcManager = async (user: PersistedUser) => {
  const userManager = getUserManager();
  const oidcUser = new User(user);
  await userManager.storeUser(oidcUser);
};

declare global {
  interface Window {
    seedEvevaultAuth?: (
      input: RawTokenInput,
      options?: SeedOptions,
    ) => Promise<void>;
    listNetworks?: () => void;
  }
}

if (import.meta.env.DEV) {
  const devWindow = window as DevWindow;

  devWindow.seedEvevaultAuth = async (
    rawInput: RawTokenInput,
    options?: SeedOptions,
  ) => {
    try {
      // Determine target network: options > current store > devnet fallback
      const targetNetwork =
        options?.network ??
        useNetworkStore.getState().chain ??
        SUI_DEVNET_CHAIN;

      log.info(`[dev-auth] Seeding auth for network: ${targetNetwork}`);

      const token = resolveToken(rawInput, targetNetwork);
      const user = await buildPersistedUser(token);
      persistAuthState(user);
      await storeUserInOidcManager(user);

      // Also update the network store to match the seeded network
      useNetworkStore.setState({ chain: targetNetwork });

      log.info(
        `[dev-auth] Seeded evevault:auth for ${targetNetwork}. Refresh to apply.`,
      );
    } catch (error) {
      log.error("[dev-auth] Failed to seed auth state", error);
      throw error;
    }
  };

  devWindow.listNetworks = () => {
    console.log("Available networks for seeding:");
    console.log(`  - ${SUI_DEVNET_CHAIN} (devnet)`);
    console.log(`  - ${SUI_TESTNET_CHAIN} (testnet)`);
    console.log("");
    console.log("Usage:");
    console.log(
      '  window.seedEvevaultAuth(tokenDump, { network: "sui:testnet" })',
    );
  };

  log.info(
    "[dev-auth] window.seedEvevaultAuth(tokenDump, { network? }) is available for seeding local auth.",
  );
  log.info("[dev-auth] window.listNetworks() shows available networks.");
}
