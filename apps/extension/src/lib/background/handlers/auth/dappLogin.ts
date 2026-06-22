import { storeJwt } from '@evevault/shared'
import {
  exchangeCodeForToken,
  getJwt,
  getZkLoginAddress,
} from '@evevault/shared/auth'
import { useContextStore, useDeviceStore } from '@evevault/shared/stores'
import type { DappRequestContext, JwtResponse } from '@evevault/shared/types'
import {
  isLocalnetChain,
  isZkLoginSuiChain,
  KeeperMessageTypes,
} from '@evevault/shared/types'
import { createLogger, toErrorMessage } from '@evevault/shared/utils'
import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519'
import { sendToTab } from '@/lib/background/messaging/tabMessaging'
import {
  getDappRequestContext,
  grantDappPermission,
} from '@/lib/background/services/dappPermissions'
import { getAuthRequest } from '@/lib/background/services/oauthService'
import { openPopupWindow } from '@/lib/background/services/popupWindow'
import type { MessageWithId } from '@/lib/background/types'
import { sendToKeeper } from '../vaultHandlers'
import {
  ensureMessageId,
  extractAuthCode,
  getCurrentChain,
  sendDappConnectSuccessToTab,
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

// The background can wake before the keeper is ready. When device data exists we
// re-check after a short delay, then a second, longer one for the slower races
// the first misses, before falling back to opening the unlock popup.
const KEEPER_WAKE_RETRY_DELAY_MS = 300
const KEEPER_UNLOCK_RETRY_DELAYS_MS = [
  KEEPER_RETRY_DELAY_MS,
  KEEPER_WAKE_RETRY_DELAY_MS,
]

// Discriminated union so callers can access publicKeyBytes only when ready.
type KeeperReadyResult =
  | { ready: true; publicKeyBytes?: number[] }
  | { ready: false }

type DappAccountMetadata = {
  address: string
  publicKey?: string
}

type DappConnectAccountResult =
  | { ok: true; account: DappAccountMetadata }
  | { ok: false; error: string }

type ZkLoginAddressResult = Awaited<ReturnType<typeof getZkLoginAddress>>

type DappConnectCompletionOptions = {
  tabId: number
  ids: string[]
  jwt: JwtResponse
  chain: ReturnType<typeof getCurrentChain>
  dappContext: DappRequestContext
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
  dappContext: DappRequestContext
}

// Sends an auth_error to the tab if tabId is defined, otherwise does nothing.
// Centralises guarded tab-bound auth errors through sendToTab.
function sendAuthErrorToTab(
  tabId: number | undefined,
  id: string,
  message: string,
  extra?: Record<string, unknown>,
): void {
  if (typeof tabId !== 'number') return
  sendToTab(tabId, {
    id,
    type: 'auth_error',
    error: { message, ...extra },
  })
}

function sendAuthErrorToTabIds(
  tabId: number | undefined,
  ids: string[],
  message: string,
): void {
  ids.forEach((id) => {
    sendAuthErrorToTab(tabId, id, message)
  })
}

// Returns true if the device store contains a persisted encrypted secret key,
// indicating the vault has been set up and can be unlocked without a fresh setup flow.
function checkHasDeviceData(): boolean {
  const key = useDeviceStore.getState().ephemeralKeyPairSecretKey
  if (!key || typeof key !== 'object') return false

  return ['iv', 'data'].every((field) => field in key)
}

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
    for (const ms of KEEPER_UNLOCK_RETRY_DELAYS_MS) {
      await delay(ms)
      keeperStatus = await checkKeeperUnlocked()
      if (keeperStatus.unlocked) break
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
    if (hasDeviceData) clearPendingAuth()
    sendAuthErrorToTab(
      tabId,
      id,
      'Failed to open vault window. Please try again.',
    )
    return { ready: false }
  }

  if (hasDeviceData) {
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

async function resolveDappConnectAccount(
  jwt: JwtResponse,
  chain: ReturnType<typeof getCurrentChain>,
): Promise<DappConnectAccountResult> {
  return isLocalnetChain(chain)
    ? resolveLocalnetDappConnectAccount()
    : resolveZkLoginDappConnectAccount(jwt)
}

async function resolveLocalnetDappConnectAccount(): Promise<DappConnectAccountResult> {
  const response = await sendToKeeper({
    type: KeeperMessageTypes.LOCALNET_GET_ADDRESS,
  })
  const address = response?.ok ? response.address : undefined

  if (!address) {
    return {
      ok: false,
      error: 'Could not retrieve localnet address',
    }
  }

  return { ok: true, account: { address } }
}

async function resolveZkLoginDappConnectAccount(
  jwt: Awaited<ReturnType<typeof getJwt>>,
): Promise<DappConnectAccountResult> {
  const accessToken = jwt?.access_token
  if (!accessToken) {
    return {
      ok: false,
      error: 'Authentication response missing account metadata.',
    }
  }

  const zkLoginResponse = await fetchDappZkLoginAddress(accessToken)

  return parseDappZkLoginAccount(zkLoginResponse)
}

async function fetchDappZkLoginAddress(
  accessToken: string,
): Promise<ZkLoginAddressResult | null> {
  return getZkLoginAddress({
    jwt: accessToken,
    enokiApiKey: import.meta.env.VITE_ENOKI_API_KEY ?? '',
  }).catch((error) => {
    log.error('Failed to resolve dApp account metadata', error)
    return null
  })
}

function parseDappZkLoginAccount(
  zkLoginResponse: ZkLoginAddressResult | null,
): DappConnectAccountResult {
  if (!zkLoginResponse) {
    return {
      ok: false,
      error: 'Could not resolve wallet account metadata.',
    }
  }

  const hasLookupError = !!zkLoginResponse.error
  if (hasLookupError) {
    return {
      ok: false,
      error: zkLoginResponse?.error?.message ?? 'Unknown authentication error',
    }
  }

  const address = zkLoginResponse.data?.address
  const publicKey = zkLoginResponse.data?.publicKey
  const account = buildDappAccountMetadata(address, publicKey)
  if (!account) {
    return {
      ok: false,
      error: 'Could not resolve wallet account metadata.',
    }
  }

  return { ok: true, account }
}

function buildDappAccountMetadata(
  address?: string,
  publicKey?: string,
): DappAccountMetadata | null {
  if (!address || !publicKey) return null

  return { address, publicKey }
}

async function completeDappConnect({
  tabId,
  ids,
  jwt,
  chain,
  dappContext,
}: DappConnectCompletionOptions): Promise<void> {
  const result = await resolveDappConnectAccount(jwt, chain)
  if (!result.ok) {
    sendAuthErrorToTabIds(tabId, ids, result.error)
    return
  }

  log.debug('Connect: sending auth_success with account metadata', {
    chain,
  })
  await grantDappPermission(dappContext, chain)
  sendDappConnectSuccessToTab(tabId, ids, {
    chain,
    address: result.account.address,
    publicKey: result.account.publicKey,
  })
}

// If the tab already has a valid JWT, sends auth_success immediately without
// going through the OAuth flow. Returns true if handled (caller should return).
async function checkExistingAuth(
  tabId: number,
  id: string,
  additionalIds: string[],
  chain: ReturnType<typeof getCurrentChain>,
  dappContext: DappRequestContext,
): Promise<boolean> {
  const existingJwt = await getJwt()
  if (!existingJwt?.id_token) return false

  log.debug('Connect: already connected, sending auth_success without OIDC')
  await completeDappConnect({
    tabId,
    ids: [id, ...additionalIds],
    jwt: existingJwt,
    chain,
    dappContext,
  })
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
    dappContext,
  } = ctx
  // The success path notifies the dApp via the tab; every failure path must do
  // the same, or the dApp's connect request hangs until it times out.
  const ids = [id, ...additionalIds]

  if (chrome.runtime.lastError || !responseUrl) {
    log.error('Auth flow returned no response', chrome.runtime.lastError)
    sendAuthErrorToTabIds(
      tabId,
      ids,
      chrome.runtime.lastError?.message ??
        'Sign-in did not complete. Please try again.',
    )
    return
  }

  const authCode = extractAuthCode(responseUrl)
  if (!authCode) {
    sendAuthErrorToTabIds(
      tabId,
      ids,
      'Authorization code not found in response.',
    )
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
      await completeDappConnect({
        tabId,
        ids,
        jwt: jwtResponse,
        chain,
        dappContext,
      })
    }
  } catch (error) {
    log.error('Token exchange failed', error)
    sendAuthErrorToTabIds(
      tabId,
      ids,
      toErrorMessage(error, 'Sign-in failed. Please try again.'),
    )
  }
}

export async function handleDappLogin(
  message: MessageWithId,
  sender: chrome.runtime.MessageSender,
  _sendResponse: (response?: unknown) => void,
  tabId?: number,
): Promise<void> {
  const id = ensureMessageId(message)
  const dappContext = getDappRequestContext(sender)
  if (!dappContext) {
    sendAuthErrorToTab(
      tabId,
      id,
      'Connect requests must come from a valid web page origin.',
    )
    return
  }

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
    if (await checkExistingAuth(tabId, id, additionalIds, chain, dappContext))
      return
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
        dappContext,
      }),
  )
}
