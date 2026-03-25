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

type JwtStorageEntry = {
  primary?: JwtResponse;
  zkLogin?: { id_token: string; expires_at: number };
};
type JwtCompositeMap = Record<SuiChain, JwtStorageEntry>;
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

function normalizeJwtEntry(value: unknown): JwtStorageEntry {
  if (typeof value === "object" && value !== null) {
    const candidate = value as { primary?: unknown; zkLogin?: unknown };
    return {
      primary: candidate.primary as JwtResponse | undefined,
      zkLogin: candidate.zkLogin as
        | { id_token: string; expires_at: number }
        | undefined,
    };
  }
  return {};
}

async function getAllJwtEntries(): Promise<Partial<JwtCompositeMap> | null> {
  if (isExtension()) {
    const result = await chrome.storage.local.get([JWT_STORAGE_KEY]);
    const raw = result[JWT_STORAGE_KEY];
    if (raw == null || typeof raw !== "object") return null;
    const entries: Partial<JwtCompositeMap> = {};
    for (const [network, value] of Object.entries(raw)) {
      entries[network as SuiChain] = normalizeJwtEntry(value);
    }
    return entries;
  }

  if (isWeb()) {
    const stored = window.localStorage.getItem(JWT_STORAGE_KEY);
    if (!stored) return null;
    try {
      const raw = JSON.parse(stored) as unknown;
      if (raw == null || typeof raw !== "object") return null;
      const entries: Partial<JwtCompositeMap> = {};
      for (const [network, value] of Object.entries(raw)) {
        entries[network as SuiChain] = normalizeJwtEntry(value);
      }
      return entries;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Store vended zkLogin JWT for a network (separate from primary OAuth JWT).
 */
export async function storeZkLoginJwtForNetwork(
  jwt: { id_token: string; expires_at: number },
  chain?: SuiChain,
): Promise<void> {
  const network = chain || useNetworkStore.getState().chain;
  const existing = await getAllJwtEntries();
  const expiresAt = jwt.expires_at;

  log.info("Storing zkLogin JWT for network", {
    network,
    hasJwt: !!jwt.id_token,
    expiresAt,
    expiresIn: expiresAt - Math.floor(Date.now() / 1000),
  });

  const current = existing?.[network] ?? { zkLogin: undefined };
  const updated: Partial<JwtCompositeMap> = {
    ...(existing || {}),
    [network]: {
      ...current,
      zkLogin: jwt,
    },
  };

  if (isExtension()) {
    await chrome.storage.local.set({ [JWT_STORAGE_KEY]: updated });
    return;
  }

  if (isWeb()) {
    window.localStorage.setItem(JWT_STORAGE_KEY, JSON.stringify(updated));
  }
}

export async function getZkLoginJwtForNetwork(
  chain?: SuiChain,
): Promise<{ id_token: string; expires_at: number } | null> {
  const network = chain || useNetworkStore.getState().chain;
  const all = await getAllJwtEntries();
  return all?.[network]?.zkLogin ?? null;
}

export async function clearZkLoginJwtForNetwork(
  chain: SuiChain,
): Promise<void> {
  const all = (await getAllJwtEntries()) ?? {};
  const entry = all[chain];
  if (!entry) return;
  const nextEntry: JwtStorageEntry = {
    ...entry,
    zkLogin: undefined,
  };
  const hasPrimary = nextEntry.primary != null;
  if (hasPrimary) {
    all[chain] = { primary: nextEntry.primary };
  } else {
    delete all[chain];
  }

  if (Object.keys(all).length === 0) {
    await clearAllJwts();
    return;
  }

  if (isExtension()) {
    await chrome.storage.local.set({ [JWT_STORAGE_KEY]: all });
    return;
  }
  if (isWeb()) {
    window.localStorage.setItem(JWT_STORAGE_KEY, JSON.stringify(all));
  }
}

/**
 * Store a JWT for a specific network
 */
export async function storeJwt(
  jwt: JwtResponse,
  chain?: SuiChain,
): Promise<void> {
  const network = chain || useNetworkStore.getState().chain;
  const existingJwts = await getAllJwtEntries();
  const expiresAt = resolveExpiresAt(jwt);

  log.info("Storing JWT for network", {
    network,
    hasJwt: !!jwt.id_token,
    expiresAt,
    expiresIn: expiresAt - Math.floor(Date.now() / 1000),
  });

  const current = existingJwts?.[network] ?? {};
  const updatedJwts: Partial<JwtCompositeMap> = {
    ...(existingJwts || {}),
    [network]: {
      ...current,
      primary: jwt,
    },
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
 * Primary OAuth JWT for a network.
 * On web, when `chain` is the active network, reads from `useAuthStore`’s OIDC `User`
 * (UserManager session) first; otherwise uses `evevault:jwt` (extension and other networks).
 */
export async function getJwtForNetwork(
  chain?: SuiChain,
): Promise<JwtResponse | null> {
  const network = chain || useNetworkStore.getState().chain;

  if (isWeb()) {
    const currentChain = useNetworkStore.getState().chain;
    if (network === currentChain) {
      const { useAuthStore } = await import("./stores/authStore");
      const { userToJwtResponse } = await import("./userToJwtResponse");
      const jwtFromUser = userToJwtResponse(useAuthStore.getState().user);
      if (jwtFromUser) {
        const expiresAt = resolveExpiresAt(jwtFromUser);
        const now = Math.floor(Date.now() / 1000);
        const isExpired = now >= expiresAt;
        log.debug("Retrieved primary JWT from OIDC user (web)", {
          network,
          hasJwt: !!jwtFromUser.id_token,
          isExpired,
          expiresAt,
          now,
        });
        if (isExpired) {
          log.info("JWT expired for network", { network, expiresAt, now });
        }
        return jwtFromUser;
      }
    }
  }

  const allJwts = await getAllJwtEntries();
  const jwt = allJwts?.[network]?.primary ?? null;

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
  const all = await getAllJwtEntries();
  if (!all) return null;
  const primaryOnly: Partial<JwtStorageMap> = {};
  for (const [network, entry] of Object.entries(all)) {
    if (entry?.primary) {
      primaryOnly[network as SuiChain] = entry.primary;
    }
  }
  return primaryOnly;
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
  const allJwts = (await getAllJwtEntries()) ?? {};
  const { [chain]: _removed, ...remaining } = allJwts;

  if (Object.keys(remaining).length === 0) {
    await clearAllJwts();
    return;
  }

  if (isExtension()) {
    await chrome.storage.local.set({ [JWT_STORAGE_KEY]: remaining });
    return;
  }

  if (isWeb()) {
    window.localStorage.setItem(JWT_STORAGE_KEY, JSON.stringify(remaining));
  }
}
