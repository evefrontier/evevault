import { SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { ephKeyService, zkProofService } from "../services/vaultService";
import { useDeviceStore } from "../stores/deviceStore";
import { useNetworkStore } from "../stores/networkStore";
import { useTokenListStore } from "../stores/tokenListStore";
import { DEFAULT_TOKENS_BY_CHAIN } from "../types/networks";
import {
  cleanupExtensionStorage,
  cleanupOidcStorage,
} from "../utils/authCleanup";
import { isExtension, isWeb } from "../utils/environment";
import { createLogger } from "../utils/logger";
import {
  EVEVAULT_STORAGE_KEYS,
  EXTENSION_EXTRA_KEYS,
  SESSION_STORAGE_REDIRECT_KEY,
} from "../utils/storageKeys";
import { getUserManager } from "./authConfig";
import { clearZkLoginAddressCache } from "./getZkLoginAddress";
import { clearAllJwts } from "./storageService";
import { useAuthStore } from "./stores/authStore";

const log = createLogger();

async function clearWebStorage(): Promise<void> {
  if (typeof window === "undefined") return;

  for (const key of EVEVAULT_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
  cleanupOidcStorage();
  window.sessionStorage.removeItem(SESSION_STORAGE_REDIRECT_KEY);
  log.info(
    "[resetVaultOnDevice] Cleared web localStorage, sessionStorage, and OIDC",
  );
}

async function clearExtensionStorage(): Promise<void> {
  await cleanupExtensionStorage();
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await new Promise<void>((resolve) => {
      chrome.storage.local.remove([...EXTENSION_EXTRA_KEYS], () => resolve());
    });
    log.info(
      "[resetVaultOnDevice] Cleared extension pendingAction/transactionResult",
    );
  }
}

function resetStoresToInitial(): void {
  useAuthStore.setState({
    user: null,
    loading: false,
    error: null,
  });

  useDeviceStore.getState().reset();

  useNetworkStore.setState({
    chain: SUI_TESTNET_CHAIN,
    loading: false,
  });

  useTokenListStore.setState({
    tokens: { ...DEFAULT_TOKENS_BY_CHAIN },
  });

  log.info("[resetVaultOnDevice] Reset in-memory stores to initial state");
}

/**
 * Resets EVE Vault on this device: clears all local/extension storage,
 * vault keypair, JWTs, OIDC state, and in-memory stores. Caller should
 * redirect to `/` after this so the user sees the Create PIN screen.
 */
export async function resetVaultOnDevice(): Promise<void> {
  log.info("[resetVaultOnDevice] Starting full device reset");

  try {
    await zkProofService.clear();
    await ephKeyService.clear();

    if (isExtension()) {
      await useDeviceStore.getState().lock();
    }

    await clearAllJwts();

    const userManager = getUserManager();
    await userManager.removeUser();

    if (isWeb()) {
      await clearWebStorage();
    } else {
      await clearExtensionStorage();
    }

    clearZkLoginAddressCache();
    resetStoresToInitial();

    log.info("[resetVaultOnDevice] Full device reset complete");
  } catch (error) {
    log.error("[resetVaultOnDevice] Reset failed", error);
    throw error;
  }
}
