import type { SuiChain } from '@mysten/wallet-standard'
import { browser } from '@wxt-dev/browser'
import type { ContextState, NetworkSwitchResult } from '#/types'
import { isLocalnetChain, isZkLoginSuiChain } from '#/types/networks'
import { createLogger, isExtension } from '#/utils'

type SetContextState = (
  partial:
    | Partial<ContextState>
    | ((state: ContextState) => Partial<ContextState> | ContextState),
) => void
type GetContextState = () => ContextState

const log = createLogger()

const SWITCHED_WITHOUT_REAUTH: NetworkSwitchResult = {
  success: true,
  requiresReauth: false,
}

/** Switching to localnet never requires re-auth; other chains need a JWT to derive the zkLogin address. */
export const checkNetworkSwitchRequirement = async (
  currentChain: SuiChain,
  nextChain: SuiChain,
): Promise<{ requiresReauth: boolean }> => {
  if (currentChain === nextChain || isLocalnetChain(nextChain)) {
    return { requiresReauth: false }
  }

  const { hasJwt } = await import('#/auth')
  return { requiresReauth: !(await hasJwt()) }
}

/** Used during logout-based network switches where normal auth checks are intentionally skipped. */
export const forceSetContextChain = (
  chain: SuiChain,
  set: SetContextState,
  get: GetContextState,
) => {
  const currentChain = get().chain
  if (currentChain !== chain) {
    log.info('Force setting chain (for logout-based switch)', {
      from: currentChain,
      to: chain,
    })
    set({ chain })
  }
}

export const setContextChain = async (
  chain: SuiChain,
  set: SetContextState,
  get: GetContextState,
): Promise<NetworkSwitchResult> => {
  const currentChain = get().chain

  if (currentChain === chain) {
    return SWITCHED_WITHOUT_REAUTH
  }

  log.info('Setting chain', { from: currentChain, to: chain })
  return isLocalnetChain(chain)
    ? switchToLocalnetChain(chain, set)
    : switchToZkLoginChain(chain, currentChain, set)
}

const switchToLocalnetChain = (
  chain: SuiChain,
  set: SetContextState,
): NetworkSwitchResult => {
  set({ chain, loading: false })
  notifyExtensionChainChanged(chain)
  log.info('Switched to localnet')
  return SWITCHED_WITHOUT_REAUTH
}

const switchToZkLoginChain = async (
  chain: SuiChain,
  previousChain: SuiChain,
  set: SetContextState,
): Promise<NetworkSwitchResult> => {
  const { hasJwt } = await import('#/auth')
  const jwtExists = await hasJwt()

  set({ chain, loading: true })
  return jwtExists
    ? switchAuthenticatedZkLoginChain(chain, previousChain, set)
    : switchReauthRequiredZkLoginChain(chain, set)
}

const switchReauthRequiredZkLoginChain = async (
  chain: SuiChain,
  set: SetContextState,
): Promise<NetworkSwitchResult> => {
  await initializeAuthAfterNetworkSwitch()
  await initializeDeviceDataAfterNetworkSwitch(chain)

  set({ loading: false })
  log.info('Switched to zkLogin chain (re-authentication required)', { chain })
  return { success: true, requiresReauth: true }
}

const switchAuthenticatedZkLoginChain = async (
  chain: SuiChain,
  previousChain: SuiChain,
  set: SetContextState,
): Promise<NetworkSwitchResult> => {
  try {
    notifyExtensionChainChanged(chain)
    await initializeDeviceDataIfNeeded(chain)

    set({ loading: false })
    log.info('Successfully switched to zkLogin chain', { chain })
    return SWITCHED_WITHOUT_REAUTH
  } catch (error) {
    log.error('Failed to complete network switch', error)
    set({ loading: false })
    set({ chain: previousChain })
    return { success: false, requiresReauth: false }
  }
}

const initializeAuthAfterNetworkSwitch = async () => {
  try {
    const { useAuthStore } = await import('#/auth')
    await useAuthStore.getState().initialize()
  } catch (error) {
    log.error('Failed to initialize auth store after network switch', error)
  }
}

const initializeDeviceDataAfterNetworkSwitch = async (chain: SuiChain) => {
  try {
    const { useDeviceStore } = await import('#/stores/deviceStore')
    await useDeviceStore.getState().initializeForChain(chain)
  } catch (error) {
    log.warn(
      'Could not pre-initialize device data for chain during network switch',
      { chain, error },
    )
  }
}

const initializeDeviceDataIfNeeded = async (chain: SuiChain) => {
  const { useDeviceStore } = await import('#/stores/deviceStore')
  const deviceStore = useDeviceStore.getState()
  const networkData = isZkLoginSuiChain(chain)
    ? deviceStore.networkData[chain]
    : undefined

  if (needsNetworkDataInitialization(networkData)) {
    await deviceStore.initializeForChain(chain)
  }
}

/** Also triggers on epoch expiry, not just missing data — expired nonces cannot be used for new zkLogin proofs. */
const needsNetworkDataInitialization = (
  networkData:
    | {
        maxEpoch?: string | null
        maxEpochTimestampMs?: number | null
        nonce?: string | null
      }
    | undefined,
): boolean => {
  return Boolean(
    !networkData?.maxEpoch ||
      !networkData.nonce ||
      (networkData.maxEpochTimestampMs != null &&
        Date.now() >= networkData.maxEpochTimestampMs),
  )
}

/** Extension background script must be notified so the wallet-standard account list reflects the new chain. */
const notifyExtensionChainChanged = (chain: SuiChain) => {
  if (isExtension()) {
    // Fire-and-forget; swallow rejection (no background listener).
    void browser.runtime
      ?.sendMessage?.({
        __from: 'Eve Vault',
        event: 'change',
        payload: { chains: [chain] },
      })
      ?.catch(() => {})
  }
}
