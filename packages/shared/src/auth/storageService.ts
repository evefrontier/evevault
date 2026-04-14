import type { SuiChain } from "@mysten/wallet-standard";
import { SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { useNetworkStore } from "../stores/networkStore";
import type { JwtResponse, OAuthTokenResponse } from "../types";
import { isExtension, isWeb } from "../utils/environment";
import { createLogger } from "../utils/logger";
import {
  AUTH_STORAGE_KEY,
  JWT_STORAGE_KEY,
  NETWORK_STORAGE_KEY,
} from "../utils/storageKeys";
import { resolveExpiresAt } from "./utils/authStoreUtils";

const log = createLogger();

/**
 * Flat storage shape. Primary OAuth JWT is network-agnostic (no nonce in redirect);
 * zkLogin JWTs remain per-chain because they are vended with a chain-specific nonce.
 */
type JwtStorage = {
  primary?: OAuthTokenResponse;
  zkLogin?: Partial<Record<SuiChain, { id_token: string; expires_at: number }>>;
};

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

async function readJwtStorage(): Promise<JwtStorage | null> {
  if (isExtension()) {
    const result = await chrome.storage.local.get([JWT_STORAGE_KEY]);
    const raw = result[JWT_STORAGE_KEY];
    if (raw == null || typeof raw !== "object") return null;
    const obj = raw as Record<string, unknown>;
    return obj as JwtStorage;
  }

  if (isWeb()) {
    const stored = window.localStorage.getItem(JWT_STORAGE_KEY);
    if (!stored) return null;
    try {
      const raw = JSON.parse(stored) as unknown;
      if (raw == null || typeof raw !== "object") return null;
      const obj = raw as Record<string, unknown>;
      return obj as JwtStorage;
    } catch {
      return null;
    }
  }

  return null;
}

async function writeJwtStorage(storage: JwtStorage): Promise<void> {
  if (isExtension()) {
    await chrome.storage.local.set({ [JWT_STORAGE_KEY]: storage });
    return;
  }

  if (isWeb()) {
    window.localStorage.setItem(JWT_STORAGE_KEY, JSON.stringify(storage));
  }
}

/**
 * Store vended zkLogin JWT for a network (separate from primary OAuth JWT).
 */
export async function storeZkLoginJwtForNetwork(
  jwt: { id_token: string; expires_at: number },
  chain?: SuiChain,
): Promise<void> {
  const network = chain ?? useNetworkStore.getState().chain;
  const existing = (await readJwtStorage()) ?? {};
  const expiresAt = jwt.expires_at;

  log.info("Storing zkLogin JWT for network", {
    network,
    hasJwt: !!jwt.id_token,
    expiresAt,
  });

  const updated: JwtStorage = {
    ...existing,
    zkLogin: {
      ...(existing.zkLogin ?? {}),
      [network]: jwt,
    },
  };

  await writeJwtStorage(updated);
}

export async function getZkLoginJwtForNetwork(
  chain?: SuiChain,
): Promise<{ id_token: string; expires_at: number } | null> {
  const network = chain ?? useNetworkStore.getState().chain;
  const storage = await readJwtStorage();
  return storage?.zkLogin?.[network] ?? null;
}

export async function clearZkLoginJwtForNetwork(
  chain: SuiChain,
): Promise<void> {
  const storage = await readJwtStorage();
  if (!storage) return;

  const { [chain]: _removed, ...remainingZkLogin } = storage.zkLogin ?? {};
  const updated: JwtStorage = {
    ...storage,
    zkLogin:
      Object.keys(remainingZkLogin).length > 0 ? remainingZkLogin : undefined,
  };

  if (!updated.primary && !updated.zkLogin) {
    await clearAllJwts();
    return;
  }

  await writeJwtStorage(updated);
}

/**
 * Store primary (OAuth) JWT. The JWT is now network-agnostic (nonce is handled
 * server-side by vendJwt), so it is stored once regardless of chain.
 * The `chain` parameter is kept for call-site compatibility but is unused.
 */
export async function storeJwt(jwt: OAuthTokenResponse): Promise<void> {
  const existing = (await readJwtStorage()) ?? {};

  log.info("Storing primary JWT", {
    hasJwt: !!jwt.id_token,
    hasRefreshToken: !!jwt.refresh_token,
    expiresAt: jwt.expires_at,
    expiresIn: jwt.expires_in,
  });

  const updated: JwtStorage = {
    ...existing,
    primary: jwt,
  };

  await writeJwtStorage(updated);
}

/**
 * Primary OAuth JWT. The JWT is now network-agnostic; the `chain` parameter is
 * ignored for storage lookup but retained for call-site compatibility.
 * On web, prefers the live OIDC UserManager session (same as before).
 */
export async function getJwtForNetwork(
  chain?: SuiChain,
): Promise<JwtResponse | null> {
  const now = Math.floor(Date.now() / 1000);

  if (isWeb()) {
    const currentChain = useNetworkStore.getState().chain;
    // Only use OIDC user when asking about the active chain
    if (!chain || chain === currentChain) {
      const { useAuthStore } = await import("./stores/authStore");
      const { userToJwtResponse } = await import("./userToJwtResponse");
      const jwtFromUser = userToJwtResponse(useAuthStore.getState().user);
      if (jwtFromUser) {
        const expiresAt = resolveExpiresAt(jwtFromUser);
        const isExpired = now >= expiresAt;
        log.debug("Retrieved primary JWT from OIDC user (web)", {
          hasJwt: !!jwtFromUser.id_token,
          isExpired,
          expiresAt,
          now,
        });
        if (isExpired) {
          log.info("[getJwtForNetwork isWeb()] JWT expired", {
            expiresAt,
            now,
          });
        }
        return jwtFromUser;
      }
    }
  }

  const storage = await readJwtStorage();
  const jwt = storage?.primary ?? null;

  if (jwt) {
    const expiresAt = resolveExpiresAt(jwt);
    const isExpired = now >= expiresAt;

    log.debug("Retrieved primary JWT from storage", {
      hasJwt: !!jwt.id_token,
      isExpired,
      expiresAt,
      now,
    });

    if (isExpired) {
      log.info("[getJwtForNetwork] JWT expired", { expiresAt, now });
    }
  } else {
    log.debug("No primary JWT found in storage");
  }

  return jwt;
}

/**
 * Get all stored JWTs. Returns the single primary entry keyed by the current
 * chain for backwards compatibility with callers expecting a chain-keyed map.
 */
export async function getAllStoredJwts(): Promise<Partial<
  Record<SuiChain, JwtResponse>
> | null> {
  const storage = await readJwtStorage();
  if (!storage?.primary) return null;
  const chain = useNetworkStore.getState().chain;
  return { [chain]: storage.primary };
}

/**
 * Check if a valid (non-expired) primary JWT exists.
 */
export async function hasJwt(): Promise<boolean> {
  const jwt = await getJwtForNetwork();
  if (!jwt?.id_token) {
    return false;
  }

  const expiresAt = resolveExpiresAt(jwt);
  const now = Math.floor(Date.now() / 1000);
  if (now >= expiresAt) {
    log.info("[hasJwt] JWT expired", { expiresAt, now });
    return false;
  }

  return true;
}

/**
 * Clear all stored JWTs (primary + all zkLogin entries).
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
 * Clear JWT data associated with a specific network.
 * Since the primary JWT is now network-agnostic, this only clears the zkLogin
 * entry for the given chain. Use `clearAllJwts` to remove the primary JWT.
 */
export async function clearJwtForNetwork(chain: SuiChain): Promise<void> {
  await clearZkLoginJwtForNetwork(chain);
}
