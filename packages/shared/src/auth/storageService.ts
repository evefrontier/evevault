import type { SuiChain } from "@mysten/wallet-standard";
import { useNetworkStore } from "../stores/networkStore";
import type { JwtResponse } from "../types";
import { isExtension, isWeb } from "../utils/environment";
import { createLogger } from "../utils/logger";
import { resolveExpiresAt } from "./utils/authStoreUtils";

const log = createLogger();

const JWT_STORAGE_KEY = "evevault:jwt";

type JwtStorageMap = Record<SuiChain, JwtResponse>;

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
