import type { SuiChain } from "@mysten/wallet-standard";
import { SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { useNetworkStore } from "../stores/networkStore";
import type { JwtResponse } from "../types";
import { isExtension, isWeb } from "../utils/environment";
import { createLogger } from "../utils/logger";
import {
  AUTH_STORAGE_KEY,
  JWT_STORAGE_KEY,
  NETWORK_STORAGE_KEY,
} from "../utils/storageKeys";
import { resolveExpiresAt } from "./utils/authStoreUtils";

const log = createLogger();

type JwtStorageMap = Record<SuiChain, JwtResponse>;

/**
 * Read the connected wallet address (sui_address) from persisted auth state.
 * Used by the background script where the auth store is not hydrated.
 * Returns null on web or when no user with profile.sui_address is stored.
 */
export async function getStoredWalletAddress(): Promise<string | null> {
  if (
    !isExtension() ||
    typeof chrome === "undefined" ||
    !chrome.storage?.local
  ) {
    return null;
  }
  const result = await chrome.storage.local.get([AUTH_STORAGE_KEY]);
  const raw = result[AUTH_STORAGE_KEY];
  if (typeof raw !== "string") {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as {
      state?: { user?: { profile?: { sui_address?: string } } };
    };
    const address = parsed?.state?.user?.profile?.sui_address;
    return typeof address === "string" ? address : null;
  } catch {
    return null;
  }
}

/**
 * Read the current chain from extension storage (chrome.storage.local).
 * Used by the background script where useNetworkStore is not hydrated.
 * In web context returns the default chain; call only from extension when possible.
 */
export async function getStoredChain(): Promise<SuiChain> {
  if (
    !isExtension() ||
    typeof chrome === "undefined" ||
    !chrome.storage?.local
  ) {
    return SUI_TESTNET_CHAIN;
  }
  const result = await chrome.storage.local.get([NETWORK_STORAGE_KEY]);
  const raw = result[NETWORK_STORAGE_KEY];
  if (typeof raw !== "string") {
    return SUI_TESTNET_CHAIN;
  }
  try {
    const parsed = JSON.parse(raw) as { state?: { chain?: SuiChain } };
    const chain = parsed?.state?.chain;
    return (typeof chain === "string" ? chain : SUI_TESTNET_CHAIN) as SuiChain;
  } catch {
    return SUI_TESTNET_CHAIN;
  }
}

/**
 * Get all stored JWTs (for all networks)
 */
async function getAllJwts(): Promise<Partial<JwtStorageMap> | null> {
  if (isExtension()) {
    const result = await chrome.storage.local.get([JWT_STORAGE_KEY]);
    return result[JWT_STORAGE_KEY] ?? null;
  }

  if (isWeb()) {
    const stored = window.localStorage.getItem(JWT_STORAGE_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as Partial<JwtStorageMap>;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Store a JWT for a specific network
 */
export async function storeJwt(
  jwt: JwtResponse,
  chain?: SuiChain,
): Promise<void> {
  const network = chain || useNetworkStore.getState().chain;
  const existingJwts = await getAllJwts();
  const expiresAt = resolveExpiresAt(jwt);

  log.info("Storing JWT for network", {
    network,
    hasJwt: !!jwt.id_token,
    expiresAt,
    expiresIn: expiresAt - Math.floor(Date.now() / 1000),
  });

  const updatedJwts: Partial<JwtStorageMap> = {
    ...(existingJwts || {}),
    [network]: jwt,
  };

  if (isExtension()) {
    await chrome.storage.local.set({ [JWT_STORAGE_KEY]: updatedJwts });
    return;
  }

  if (isWeb()) {
    window.localStorage.setItem(JWT_STORAGE_KEY, JSON.stringify(updatedJwts));
    return;
  }
}

/**
 * Get the JWT for a specific network
 */
export async function getJwtForNetwork(
  chain?: SuiChain,
): Promise<JwtResponse | null> {
  const network = chain || useNetworkStore.getState().chain;
  const allJwts = await getAllJwts();
  const jwt = allJwts?.[network] ?? null;

  if (jwt) {
    const expiresAt = resolveExpiresAt(jwt);
    const now = Math.floor(Date.now() / 1000);
    const isExpired = now >= expiresAt;

    log.debug("Retrieved JWT for network", {
      network,
      hasJwt: !!jwt.id_token,
      isExpired,
      expiresAt,
      now,
    });

    if (isExpired) {
      log.info("JWT expired for network", { network, expiresAt, now });
    }
  } else {
    log.debug("No JWT found for network", { network });
  }

  return jwt;
}

/**
 * Get all stored JWTs (for backwards compatibility and multi-network checks)
 */
export async function getAllStoredJwts(): Promise<Partial<JwtStorageMap> | null> {
  return getAllJwts();
}

/**
 * Check if a JWT exists for a specific network and is not expired
 */
export async function hasJwtForNetwork(chain: SuiChain): Promise<boolean> {
  const jwt = await getJwtForNetwork(chain);
  if (!jwt || !jwt.id_token) {
    return false;
  }

  // Check if JWT is expired
  const expiresAt = resolveExpiresAt(jwt);
  const now = Math.floor(Date.now() / 1000);
  if (now >= expiresAt) {
    log.info("JWT expired for network", { chain, expiresAt, now });
    return false;
  }

  return true;
}

/**
 * Clear all stored JWTs
 */
export async function clearAllJwts(): Promise<void> {
  if (isExtension()) {
    await chrome.storage.local.remove([JWT_STORAGE_KEY]);
    return;
  }

  if (isWeb()) {
    window.localStorage.removeItem(JWT_STORAGE_KEY);
    return;
  }
}

/**
 * Clear JWT for a specific network only
 */
export async function clearJwtForNetwork(chain: SuiChain): Promise<void> {
  const allJwts = await getAllJwts();
  if (!allJwts) return;

  const { [chain]: _removedJwt, ...remainingJwts } = allJwts;

  if (Object.keys(remainingJwts).length === 0) {
    await clearAllJwts();
    return;
  }

  if (isExtension()) {
    await chrome.storage.local.set({ [JWT_STORAGE_KEY]: remainingJwts });
    return;
  }

  if (isWeb()) {
    window.localStorage.setItem(JWT_STORAGE_KEY, JSON.stringify(remainingJwts));
    return;
  }
}
