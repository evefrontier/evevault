import type { SuiChain } from "@mysten/wallet-standard";
import { SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { useNetworkStore } from "#/stores/networkStore";
import type { JwtResponse, OAuthTokenResponse } from "#/types";
import { isExtension, isWeb } from "#/utils/environment";
import { createLogger } from "#/utils/logger";
import { JWT_STORAGE_KEY, NETWORK_STORAGE_KEY } from "#/utils/storageKeys";
import { resolveExpiresAt } from "./utils/authStoreUtils";

const log = createLogger();

/**
 * Flat storage shape. zkLogin JWTs remain per-chain
 * because they are vended with a chain-specific nonce.
 */
type JwtStorage = {
  primary?: OAuthTokenResponse;
  zkLogin?: Partial<Record<SuiChain, { id_token: string; expires_at: number }>>;
};

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

function getSessionStorage() {
  if (typeof chrome === "undefined" || !chrome.storage?.session) {
    log.warn(
      "chrome.storage.session unavailable — JWT will not persist this session",
    );
    return null;
  }
  return chrome.storage.session;
}

async function readJwtStorage(): Promise<JwtStorage | null> {
  if (isExtension()) {
    const session = getSessionStorage();
    if (!session) return null;
    const result = await session.get([JWT_STORAGE_KEY]);
    const raw = result[JWT_STORAGE_KEY];
    if (raw == null || typeof raw !== "object") return null;
    return raw as JwtStorage;
  }

  return null;
}

async function writeJwtStorage(storage: JwtStorage): Promise<void> {
  if (isExtension()) {
    const session = getSessionStorage();
    if (!session) return;
    await session.set({ [JWT_STORAGE_KEY]: storage });
    return;
  }
  // Web: zkLogin JWTs are intentionally not persisted — resolveVendedIdTokenForZkProof
  // always vends fresh because getZkLoginJwtForNetwork returns null. If web storage is
  // ever added here, clearAllZkLoginJwts must be updated to clear it too, otherwise
  // ephemeral key rotation will leave stale JWTs tied to the old nonce.
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

  log.info("Storing zkLogin JWT for network", {
    network,
    hasJwt: !!jwt.id_token,
    expiresAt: jwt.expires_at,
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

// On web, this is a no-op because writeJwtStorage does not persist zkLogin JWTs.
// If web storage is added to writeJwtStorage, this function must clear it too.
export async function clearAllZkLoginJwts(): Promise<void> {
  const storage = await readJwtStorage();
  if (!storage?.zkLogin) return;

  if (!storage.primary) {
    await clearAllJwts();
    return;
  }

  await writeJwtStorage({ primary: storage.primary });
}

/**
 * Store network-agnostic primary (OAuth) JWT.
 */
export async function storeJwt(jwt: OAuthTokenResponse): Promise<void> {
  const existing = (await readJwtStorage()) ?? {};

  log.info("Storing primary JWT", {
    hasJwt: !!jwt.id_token,
    hasRefreshToken: !!jwt.refresh_token,
    expiresAt: jwt.expires_at,
    expiresIn: jwt.expires_in,
  });

  await writeJwtStorage({ ...existing, primary: jwt });
}

/**
 * Primary OAuth JWT. On web, prefers the live OIDC UserManager session;
 * falls back to persisted storage (used by the extension).
 */
export async function getJwt(): Promise<JwtResponse | null> {
  const now = Math.floor(Date.now() / 1000);

  if (isWeb()) {
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
        log.info("[getJwt] JWT expired", { expiresAt, now });
      }
      return jwtFromUser;
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
      log.info("[getJwt] JWT expired in storage", { expiresAt, now });
    }
  } else {
    log.debug("No primary JWT found in storage");
  }

  return jwt;
}

/**
 * Check if a valid (non-expired) primary JWT exists.
 */
export async function hasJwt(): Promise<boolean> {
  const jwt = await getJwt();
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
 * Clear all stored JWTs (primary + all zkLogin entries) for extension storage.
 */
export async function clearAllJwts(): Promise<void> {
  if (isExtension()) {
    const session = getSessionStorage();
    if (!session) return;
    await session.remove([JWT_STORAGE_KEY]);
    return;
  }
}
