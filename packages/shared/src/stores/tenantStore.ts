import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { chromeStorageAdapter, localStorageAdapter } from "../adapters";
import type { TenantId, TenantState } from "../types";
import { isWeb } from "../utils/environment";
import {
  getAvailableTenantIds,
  isAvailableTenantId,
} from "../utils/tenantConfig";

const STORAGE_KEY = "evevault:tenant";

/** Must match DEFAULT_TENANT_ID in utils/tenantConfig; avoid getDefaultTenantId() here to prevent circular load (tenantConfig imports from stores). */
const INITIAL_TENANT_ID = "stillness" as TenantId;

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      tenantId: INITIAL_TENANT_ID,

      setTenantId: async (id: TenantId) => {
        // Always set tenantId as long as it is in the list
        if (!getAvailableTenantIds(true).includes(id)) {
          return;
        }
        set({ tenantId: id });
      },

      devMode: false,
      setDevMode: (value) => set({ devMode: value }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        tenantId: state.tenantId,
        devMode: state.devMode,
      }),
      storage: createJSONStorage<Pick<TenantState, "tenantId">>(() =>
        isWeb() ? localStorageAdapter : chromeStorageAdapter,
      ),
    },
  ),
);

// In extension, sync tenant store when another context (e.g. popup) updates chrome.storage
if (typeof chrome !== "undefined" && chrome.storage && !isWeb()) {
  const storage = chrome.storage as {
    onChanged?: {
      addListener: (
        callback: (changes: Record<string, unknown>, areaName: string) => void,
      ) => void;
    };
  };
  storage.onChanged?.addListener(
    (changes: Record<string, unknown>, areaName: string) => {
      if (areaName === "local" && changes[STORAGE_KEY]) {
        void useTenantStore.persist.rehydrate();
      }
    },
  );
}

/**
 * Returns the current tenant id (for auth config, token exchange, etc.).
 * Persisted in localStorage (web) or chrome.storage.local (extension); in extension,
 * background and popup stay in sync via storage.onChanged. In web, call
 * applyTenantFromUrl() on load to sync from ?tenant= before using this.
 * Pass devMode when known (e.g. from UI); when omitted, defaults to false (production).
 */
export function getCurrentTenantId(): TenantId {
  const state = useTenantStore.getState();
  return isAvailableTenantId(state.tenantId, state.devMode)
    ? state.tenantId
    : INITIAL_TENANT_ID;
}

/**
 * Sets the current tenant and persists to storage (web: localStorage, extension: chrome.storage.local).
 * Validates against available tenants for current dev mode (async).
 */
export async function setCurrentTenantId(id: TenantId): Promise<void> {
  await useTenantStore.getState().setTenantId(id);
}

/**
 * If running in web and URL has ?tenant=<id>, updates store to that tenant and returns true.
 * Does not run tenant-switch flow; caller should do that when tenant actually changes.
 */
export async function applyTenantFromUrl(): Promise<{
  tenantId: TenantId;
  changed: boolean;
}> {
  const current = getCurrentTenantId();
  if (!isWeb() || typeof window === "undefined") {
    return { tenantId: current, changed: false };
  }
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("tenant");
  if (!fromUrl || !isAvailableTenantId(fromUrl, true)) {
    return { tenantId: current, changed: false };
  }
  if (fromUrl === current) {
    return { tenantId: current, changed: false };
  }
  await setCurrentTenantId(fromUrl);
  return { tenantId: fromUrl, changed: true };
}

export const OAuthTenantSessionKey = "evevault_oauth_tenant";
