import type { TenantId } from '@evefrontier/wallet-core/tenant'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { chromeStorageAdapter, localStorageAdapter } from '#/adapters'
import { getUserManager, redirectToFusionAuthLogout } from '#/auth/authConfig'
import { clearZkLoginAddressCache } from '#/auth/getZkLoginAddress'
import { clearAllJwts } from '#/auth/storageService'
import {
  clearAuthSession,
  createExtensionAuthListener,
  finishExtensionLogout,
  getEnokiApiKey,
  getErrorMessage,
  initializeExtensionSession,
  initializeWebSession,
  loginExtensionSession,
  loginWebSession,
} from '#/auth/stores/authStoreWorkflows'
import type { AuthState } from '#/auth/types'
import { zkProofService } from '#/services/vaultService'
import { useContextStore } from '#/stores'
import { getCurrentTenantId, setCurrentTenantId } from '#/stores/tenantStore'
import { createLogger, isExtension, isWeb, performFullCleanup } from '#/utils'
import { AUTH_STORAGE_KEY } from '#/utils/storageKeys'

// biome-ignore lint/suspicious/noExplicitAny: chrome is a global object
declare const chrome: any

export { getEnokiApiKey }

const log = createLogger()

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => {
      // Lazy getter for userManager to avoid initialization order issues
      const getUserManagerInstance = () => getUserManager(getCurrentTenantId())

      return {
        user: null,
        loading: false,
        error: null,

        initialize: async () => {
          set({ loading: true })
          const network = useContextStore.getState().chain

          try {
            const user =
              isExtension() && typeof chrome !== 'undefined'
                ? await initializeExtensionSession(
                    getUserManagerInstance,
                    network,
                  )
                : await initializeWebSession(getUserManagerInstance, network)

            set({ user, loading: false })
          } catch (error) {
            log.error('Error initializing auth', error)
            set({
              user: null,
              loading: false,
              error: getErrorMessage(error),
            })
          }
        },

        setUser: (user) => set({ user }),

        login: async () => {
          const network = useContextStore.getState().chain
          set({ loading: true })

          if (isExtension()) {
            return loginExtensionSession(get, set, getUserManagerInstance)
          }

          await loginWebSession(set, getUserManagerInstance, network)
        },

        extensionLogin: async () => {
          return new Promise((resolve, reject) => {
            if (!isExtension()) {
              reject(new Error('Extension APIs unavailable in this context'))
              return
            }

            const id = crypto.randomUUID()
            const authSuccessListener = createExtensionAuthListener(
              id,
              resolve,
              reject,
            )
            chrome.runtime?.onMessage?.addListener(authSuccessListener)
            chrome.runtime?.sendMessage?.({
              action: 'ext_login',
              id: id,
              tenantId: getCurrentTenantId(),
            })
          })
        },

        logout: async () => {
          try {
            await clearAuthSession(set, getUserManagerInstance)

            if (isExtension() && typeof chrome !== 'undefined') {
              finishExtensionLogout()
            } else {
              // For web, just redirect to home - FusionAuth session can remain
              // (user will re-authenticate to get new JWT with correct network params)
              // Note: If full FusionAuth logout is needed, configure post_logout_redirect_uri
              // in FusionAuth OAuth settings
              window.location.href = window.location.origin
            }
          } catch (error) {
            log.error('Error during logout cleanup', error)
            set({
              user: null,
              error: getErrorMessage(error),
            })

            // Fallback: redirect so user is not stuck
            redirectToFusionAuthLogout()
          }
        },
      }
    },
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() =>
        isWeb() ? localStorageAdapter : chromeStorageAdapter,
      ),
      // Tokens are managed by context-specific session storage (oidc-client-ts
      // sessionStorage on web; chrome.storage.session on extension).
      partialize: (state) => {
        const { user: _user, ...rest } = state
        return rest as typeof state
      },
      onRehydrateStorage: () => {
        return async (state, error) => {
          if (error) {
            log.error('Error rehydrating auth store', error)
            return
          }

          if (state) {
            log.debug('Rehydrated auth store', state)
          }
        }
      },
    },
  ),
)

/**
 * Clears auth state for the given tenant (no redirect).
 * Used when switching server so the next login uses the new tenant.
 */
export async function runTenantSwitchCleanup(
  tenantId: TenantId,
): Promise<void> {
  // TODO: Do not clean up PIN, maintain existing ephemeral key and nonce for network
  try {
    await getUserManager(tenantId).removeUser()
    await performFullCleanup()
    await clearAllJwts()
    clearZkLoginAddressCache()
    useAuthStore.getState().setUser(null)
    await zkProofService.clear()
  } catch (error) {
    log.error('Error during tenant switch cleanup', error)
  }
}

/**
 * Clears auth state for current tenant and redirects to app home with new tenant.
 * Used when switching server (tenant) via dev dropdown.
 */
export async function switchTenantAndReload(
  newTenantId: TenantId,
): Promise<void> {
  const current = getCurrentTenantId()
  if (current === newTenantId) return

  await runTenantSwitchCleanup(current)
  await setCurrentTenantId(newTenantId as TenantId)

  if (isWeb() && typeof window !== 'undefined') {
    window.location.reload()
  }
}

export const waitForAuthHydration = async () => {
  if (useAuthStore.persist.hasHydrated()) {
    return
  }

  await new Promise<void>((resolve) => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      unsub()
      resolve()
    })
    useAuthStore.persist.rehydrate()
  })
}

// Set up event listeners outside the store (lazy initialization to avoid module load order issues)
let eventListenersInitialized = false

function initializeEventListeners() {
  if (eventListenersInitialized) return
  eventListenersInitialized = true
  // Ensure current tenant's UserManager is created (handlers are registered in authConfig)
  getUserManager(getCurrentTenantId())
}

if (typeof window !== 'undefined') {
  queueMicrotask(initializeEventListeners)
}
