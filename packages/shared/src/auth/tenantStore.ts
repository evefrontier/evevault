import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { chromeStorageAdapter, localStorageAdapter } from "../adapters";
import { isWeb } from "../utils/environment";
import {
  getAvailableTenantIds,
  getDefaultTenantId,
  isAvailableTenantId,
  type TenantId,
} from "./tenantConfig";

const STORAGE_KEY = "evevault:tenant";

interface TenantState {
  tenantId: TenantId;
  setTenantId: (id: TenantId) => void;
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      tenantId: getDefaultTenantId(),
      setTenantId: (id: TenantId) => {
        if (!getAvailableTenantIds().includes(id)) {
          return;
        }
        set({ tenantId: id });
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ tenantId: state.tenantId }),
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
 */
export function getCurrentTenantId(): TenantId {
  const stored = useTenantStore.getState().tenantId;
  return isAvailableTenantId(stored) ? stored : getDefaultTenantId();
}

/**
 * Sets the current tenant and persists to storage (web: localStorage, extension: chrome.storage.local).
 */
export function setCurrentTenantId(id: TenantId): void {
  useTenantStore.getState().setTenantId(id);
}

/**
 * If running in web and URL has ?tenant=<id>, updates store to that tenant and returns true.
 * Does not run tenant-switch flow; caller should do that when tenant actually changes.
 */
export function applyTenantFromUrl(): { tenantId: TenantId; changed: boolean } {
  const current = getCurrentTenantId();
  if (!isWeb() || typeof window === "undefined") {
    return { tenantId: current, changed: false };
  }
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("tenant");
  if (!fromUrl || !isAvailableTenantId(fromUrl)) {
    return { tenantId: current, changed: false };
  }
  if (fromUrl === current) {
    return { tenantId: current, changed: false };
  }
  setCurrentTenantId(fromUrl);
  return { tenantId: fromUrl, changed: true };
}

export const OAuthTenantSessionKey = "evevault_oauth_tenant";
