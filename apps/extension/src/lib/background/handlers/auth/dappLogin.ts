import { storeJwt } from '@evevault/shared'
import { exchangeCodeForToken, getJwt } from '@evevault/shared/auth'
import { useContextStore, useDeviceStore } from '@evevault/shared/stores'
import {
  isLocalnetChain,
  isZkLoginSuiChain,
  KeeperMessageTypes,
} from '@evevault/shared/types'
import { createLogger } from '@evevault/shared/utils'
import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519'
import { getAuthRequest } from '@/lib/background/services/oauthService'
import { openPopupWindow } from '@/lib/background/services/popupWindow'
import type { MessageWithId } from '@/lib/background/types'
import { sendToKeeper } from '../vaultHandlers'
import {
  buildAuthSuccessToken,
  ensureMessageId,
  extractAuthCode,
  getCurrentChain,
  sendAuthSuccessToTab,
} from './authHelpers'
import {
  checkKeeperUnlocked,
  getEphemeralKeyPairSecretKeyFromStorage,
} from './keeperHelpers'
import {
  addPendingDappId,
  clearPendingAuth,
  getPending,
  KEEPER_RETRY_DELAY_MS,
  setPendingAuthAfterUnlock,
  setPendingAuthWindowId,
} from './pendingAuth'

const log = createLogger()

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

// Sends an auth_error to the tab if tabId is defined, otherwise does nothing.
// Centralises the repeated `if (typeof tabId === 'number') chrome.tabs.sendMessage` pattern.
function sendAuthErrorToTab(
  tabId: number | undefined,
  id: string,
  message: string,
  extra?: Record<string, unknown>,
): void {
  if (typeof tabId !== 'number') return
  chrome.tabs.sendMessage(tabId, {
    id,
    type: 'auth_error',
    error: { message, ...extra },
  })
}

// Returns true if the device store contains a persisted encrypted secret key,
// indicating the vault has been set up and can be unlocked without a fresh setup flow.
function checkHasDeviceData(): boolean {
  const key = useDeviceStore.getState().ephemeralKeyPairSecretKey
  return !!(key && typeof key === 'object' && 'iv' in key && 'data' in key)
}

// Discriminated union so callers can access publicKeyBytes only when ready.
type KeeperReadyResult =
  | { ready: true; publicKeyBytes?: number[] }
  | { ready: false }

// Checks that the keeper is unlocked, retrying briefly if device data exists
// (handles the race where the background script wakes before keeper is ready).
// If still locked, opens the vault popup and deduplicates concurrent requests.
async function ensureKeeperReady(
  hasDeviceData: boolean,
  id: string,
  tabId: number | undefined,
  chain: ReturnType<typeof getCurrentChain>,
): Promise<KeeperReadyResult> {
  let keeperStatus = await checkKeeperUnlocked()

  if (!keeperStatus.unlocked && hasDeviceData) {
    await delay(KEEPER_RETRY_DELAY_MS)
    keeperStatus = await checkKeeperUnlocked()
    if (!keeperStatus.unlocked) {
      await delay(300)
      keeperStatus = await checkKeeperUnlocked()
    }
  }

  if (keeperStatus.unlocked) {
    return { ready: true, publicKeyBytes: keeperStatus.publicKeyBytes }
  }

  log.error('Cannot login: vault not set up or locked', {
    chain,
    hasDeviceData,
  })

  if (typeof tabId === 'number') {
    const pending = getPending()
    if (
      pending?.type === 'dapp' &&
      pending.tabId === tabId &&
      addPendingDappId(tabId, id)
    ) {
      log.debug('Connect deduplicated for tab', { tabId, id })
      return { ready: false }
    }
  }

  useDeviceStore.setState({ isLocked: true })
  if (hasDeviceData) setPendingAuthAfterUnlock(id, 'dapp', tabId)

  const windowId = await openPopupWindow('popup')

  if (windowId === undefined) {
    log.warn('Failed to open vault popup window')
    if (hasDeviceData) {
      clearPendingAuth()
      sendAuthErrorToTab(
        tabId,
        id,
        'Failed to open vault window. Please try again.',
      )
      return { ready: false }
    }
  } else if (hasDeviceData) {
    setPendingAuthWindowId(id, windowId)
    return { ready: false }
  }

  sendAuthErrorToTab(
    tabId,
    id,
    'Please set up or unlock the vault in the window we opened, then try again.',
    { vaultOpened: true },
  )
  return { ready: false }
}

// Copies the ephemeral public key from the keeper response into deviceStore if
// it isn't already there — handles the case where the store rehydrates after
// the keeper has already unlocked.
async function syncPublicKeyFromKeeper(
  publicKeyBytes: number[] | undefined,
  id: string,
  tabId: number | undefined,
): Promise<boolean> {
  const deviceStore = useDeviceStore.getState()
  if (deviceStore.ephemeralPublicKey || !publicKeyBytes?.length) return true

  log.info('Syncing ephemeral public key from keeper to deviceStore')
  try {
    const publicKey = new Ed25519PublicKey(new Uint8Array(publicKeyBytes))
    const secretKeyToPreserve =
      deviceStore.ephemeralKeyPairSecretKey ||
      (await getEphemeralKeyPairSecretKeyFromStorage())
    useDeviceStore.setState({
      ephemeralPublicKey: publicKey,
      ephemeralPublicKeyBytes: publicKeyBytes,
      ephemeralPublicKeyFlag: publicKey.flag(),
      ephemeralKeyPairSecretKey: secretKeyToPreserve,
      isLocked: false,
    })
    log.debug('Successfully synced ephemeral public key to deviceStore')
    return true
  } catch (error) {
    log.error('Failed to sync public key from keeper', error)
    sendAuthErrorToTab(
      tabId,
      id,
      'Failed to sync vault state. Please try unlocking again.',
    )
    return false
  }
}

// If the tab already has a valid JWT, sends auth_success immediately without
// going through the OAuth flow. Returns true if handled (caller should return).
async function checkExistingAuth(
  tabId: number,
  id: string,
  additionalIds: string[],
  chain: ReturnType<typeof getCurrentChain>,
): Promise<boolean> {
  const existingJwt = await getJwt()
  if (!existingJwt?.id_token) return false

  log.debug('Connect: already connected, sending auth_success without OIDC')
  const token = buildAuthSuccessToken(existingJwt)

  if (isLocalnetChain(chain)) {
    const response = await sendToKeeper({
      type: KeeperMessageTypes.LOCALNET_GET_ADDRESS,
    })
    log.debug('Connect: localnet, sending auth_success with localnet address')
    if (response?.ok && response?.address) {
      sendAuthSuccessToTab(tabId, [id, ...additionalIds], token, {
        chain,
        address: response.address,
      })
    } else {
      chrome.tabs.sendMessage(tabId, {
        id,
        type: 'auth_error',
        error: { message: 'Could not retrieve localnet address' },
      })
    }
    return true
  }

  sendAuthSuccessToTab(tabId, [id, ...additionalIds], token, { chain })
  return true
}

// Returns the zkLogin nonce for the chain, initializing device data if needed.
// Returns null (and sends an error to the tab) if the chain isn't zkLogin-capable
// or if initialization fails.
async function ensureNonce(
  chain: ReturnType<typeof getCurrentChain>,
  id: string,
  tabId: number | undefined,
): Promise<string | null> {
  if (!isZkLoginSuiChain(chain)) return null

  let nonce = useDeviceStore.getState().networkData[chain]?.nonce
  if (!nonce) {
    try {
      await useDeviceStore.getState().initializeForChain(chain)
    } catch (error) {
      log.error('Failed to initialize device data for chain', { chain, error })
      sendAuthErrorToTab(
        tabId,
        id,
        'Could not prepare sign-in. Please try again.',
      )
      return null
    }
    nonce = useDeviceStore.getState().networkData[chain]?.nonce
  }
  if (!nonce) {
    sendAuthErrorToTab(
      tabId,
      id,
      'Could not prepare sign-in. Please try again.',
    )
    return null
  }
  return nonce
}

// Context threaded into the launchWebAuthFlow callback, which runs outside the
// normal async scope and can't capture variables from the surrounding await chain.
type OAuthCallbackContext = {
  id: string
  additionalIds: string[]
  chain: ReturnType<typeof getCurrentChain>
  chromeRedirectUri: string
  tenant: string
  codeVerifier: string
  tabId: number | undefined
}

// Processes the redirect URL from chrome.identity.launchWebAuthFlow: exchanges
// the auth code for a JWT, stores it, and sends auth_success to the originating tab.
async function handleOAuthCallback(
  responseUrl: string | undefined,
  ctx: OAuthCallbackContext,
): Promise<void> {
  const {
    id,
    additionalIds,
    chain,
    chromeRedirectUri,
    tenant,
    codeVerifier,
    tabId,
  } = ctx

  if (chrome.runtime.lastError || !responseUrl) {
    chrome.runtime.sendMessage({
      id,
      auth_success: false,
      error: chrome.runtime.lastError?.message || 'responseUrl not found',
    })
    chrome.runtime.sendMessage({
      id,
      type: 'auth_error',
      error: chrome.runtime.lastError,
    })
    return
  }

  const authCode = extractAuthCode(responseUrl)
  if (!authCode) {
    chrome.runtime.sendMessage({
      id,
      auth_success: false,
      error: 'Authorization code not found in response.',
    })
    return
  }

  log.debug('Auth code received')

  try {
    const jwtResponse = await exchangeCodeForToken(
      authCode,
      chromeRedirectUri,
      tenant,
      { codeVerifier },
    )
    await storeJwt(jwtResponse)

    if (typeof tabId === 'number') {
      const token = buildAuthSuccessToken(jwtResponse)
      if (isLocalnetChain(chain)) {
        const addrResponse = await sendToKeeper({
          type: KeeperMessageTypes.LOCALNET_GET_ADDRESS,
        })
        sendAuthSuccessToTab(tabId, [id, ...additionalIds], token, {
          chain,
          address: addrResponse?.address,
          logger: log,
        })
      } else {
        sendAuthSuccessToTab(tabId, [id, ...additionalIds], token, {
          chain,
          logger: log,
        })
      }
    }
  } catch (error) {
    log.error('Token exchange failed', error)
    chrome.runtime.sendMessage({
      id,
      auth_success: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function handleDappLogin(
  message: MessageWithId,
  _sender: chrome.runtime.MessageSender,
  _sendResponse: (response?: unknown) => void,
  tabId?: number,
): Promise<void> {
  const id = ensureMessageId(message)
  const additionalIds =
    (message as MessageWithId & { additionalIds?: string[] }).additionalIds ??
    []
  const tenant = useContextStore.getState().tenantId
  const chain = getCurrentChain()
  const hasDeviceData = checkHasDeviceData()

  const keeperResult = await ensureKeeperReady(hasDeviceData, id, tabId, chain)
  if (!keeperResult.ready) return

  if (!(await syncPublicKeyFromKeeper(keeperResult.publicKeyBytes, id, tabId)))
    return

  if (
    !useDeviceStore.getState().ephemeralPublicKey &&
    !isLocalnetChain(chain)
  ) {
    log.error('Keeper is unlocked but no public key bytes available', { chain })
    sendAuthErrorToTab(
      tabId,
      id,
      'Vault state is inconsistent. Please unlock the vault again.',
    )
    return
  }

  if (typeof tabId === 'number') {
    if (await checkExistingAuth(tabId, id, additionalIds, chain)) return
  }

  const nonce = await ensureNonce(chain, id, tabId)
  if (!nonce) return

  const chromeRedirectUri = chrome.identity.getRedirectURL()
  const { authUrl, codeVerifier } = await getAuthRequest({
    tenantId: tenant,
    nonce,
  })
  chrome.identity.launchWebAuthFlow(
    { url: authUrl.toString(), interactive: true },
    (responseUrl) =>
      handleOAuthCallback(responseUrl, {
        id,
        additionalIds,
        chain,
        chromeRedirectUri,
        tenant,
        codeVerifier,
        tabId,
      }),
  )
}
