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
import { type Browser, browser } from 'wxt/browser'
import {
  sendToTab,
  type TabDocument,
} from '@/lib/background/messaging/tabMessaging'
import {
  getDappRequestContext,
  grantDappPermission,
  hasDappPermission,
} from '@/lib/background/services/dappPermissions'
import { getAuthRequest } from '@/lib/background/services/oauthService'
import { openPopupWindow } from '@/lib/background/services/popupWindow'
import type { MessageWithId } from '@/lib/background/types'
import { sendToKeeper } from '../vaultHandlers'
import {
  ensureMessageId,
  extractAuthCode,
  extractState,
  getCurrentChain,
  sendDappConnectSuccessToTab,
} from './authHelpers'
import {
  checkKeeperUnlocked,
  getEphemeralKeyPairSecretKeyFromStorage,
} from './keeperHelpers'
import {
  addPendingDappId,
  KEEPER_RETRY_DELAY_MS,
  sendPendingAuthError,
  setPendingAuthAfterUnlock,
  setPendingAuthWindowId,
  takePendingAttempt,
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
  target: TabDocument
  ids: string[]
  jwt: JwtResponse
  chain: ReturnType<typeof getCurrentChain>
  dappContext: DappRequestContext
  silent?: boolean
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
  state: string
  nonce: string
  target: TabDocument
  dappContext: DappRequestContext
}

/** A dapp connect bound to the page document that sent it. */
export type DappConnectRequest = {
  id: string
  additionalIds: string[]
  target: TabDocument
  dappContext: DappRequestContext
  /** Declined without UI when it can't be satisfied; never becomes pending. */
  silent?: boolean
}

// Sends an auth_error to the target document.
// Centralises tab-bound auth errors through sendToTab.
function sendAuthErrorToTab(
  target: TabDocument,
  id: string,
  message: string,
  extra?: Record<string, unknown>,
): void {
  sendToTab(target, {
    id,
    type: 'auth_error',
    error: { message, ...extra },
  })
}

// Declines a silent connect; the adapter answers it with no accounts.
function declineSilentConnect(
  target: TabDocument,
  ids: string[],
  dappContext: DappRequestContext,
  reason: string,
): void {
  log.debug('Declined silent connect', { origin: dappContext.origin, reason })
  sendAuthErrorToTabIds(target, ids, `Silent connect declined: ${reason}.`)
}

function sendAuthErrorToTabIds(
  target: TabDocument,
  ids: string[],
  message: string,
): void {
  ids.forEach((id) => {
    sendAuthErrorToTab(target, id, message)
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
// If still locked, declines a silent request, otherwise opens the vault popup
// and deduplicates concurrent requests.
async function ensureKeeperReady(
  hasDeviceData: boolean,
  id: string,
  target: TabDocument,
  chain: ReturnType<typeof getCurrentChain>,
  dappContext: DappRequestContext,
  silent: boolean,
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

  if (silent) {
    declineSilentConnect(
      target,
      [id],
      dappContext,
      hasDeviceData ? 'vault is locked' : 'vault is not set up',
    )
    return { ready: false }
  }

  log.error('Cannot login: vault not set up or locked', {
    chain,
    hasDeviceData,
  })

  if (addPendingDappId(target, id, dappContext)) {
    log.debug('Connect deduplicated for tab', { tabId: target.tabId, id })
    return { ready: false }
  }

  useDeviceStore.setState({ isLocked: true })
  const attempt = hasDeviceData
    ? setPendingAuthAfterUnlock({ id, type: 'dapp', target, dappContext })
    : undefined

  const windowId = await openPopupWindow('popup')

  if (windowId === undefined) {
    log.warn('Failed to open vault popup window')
    const message = 'Failed to open vault window. Please try again.'
    if (attempt === undefined) {
      sendAuthErrorToTab(target, id, message)
    } else {
      // The pending may have gained or swapped ids and documents while the
      // popup was opening. If a newer attempt replaced it, its requests were
      // already notified.
      const pending = takePendingAttempt(attempt)
      if (pending) sendPendingAuthError(pending, message)
    }
    return { ready: false }
  }

  if (attempt !== undefined) {
    setPendingAuthWindowId(attempt, windowId)
    return { ready: false }
  }

  sendAuthErrorToTab(
    target,
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
  target: TabDocument,
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
      target,
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

  const { address, publicKey } = zkLoginResponse
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
  target,
  ids,
  jwt,
  chain,
  dappContext,
  silent = false,
}: DappConnectCompletionOptions): Promise<void> {
  const result = await resolveDappConnectAccount(jwt, chain)
  if (!result.ok) {
    sendAuthErrorToTabIds(target, ids, result.error)
    return
  }

  // A silent connect never grants. It re-checks the permission after the
  // account lookup, so a disconnect made meanwhile is not undone.
  if (silent) {
    if (!(await hasDappPermission(dappContext.origin, chain))) {
      declineSilentConnect(target, ids, dappContext, 'site not connected')
      return
    }
  } else {
    await grantDappPermission(dappContext, chain)
  }

  log.debug('Connect: sending auth_success with account metadata', {
    chain,
  })
  sendDappConnectSuccessToTab(target, ids, {
    chain,
    address: result.account.address,
    publicKey: result.account.publicKey,
  })
}

// If the tab already has a valid JWT, sends auth_success immediately without
// going through the OAuth flow. Returns true if handled (caller should return).
async function checkExistingAuth(
  target: TabDocument,
  id: string,
  additionalIds: string[],
  chain: ReturnType<typeof getCurrentChain>,
  dappContext: DappRequestContext,
  silent: boolean,
): Promise<boolean> {
  const existingJwt = await getJwt()
  if (!existingJwt?.id_token) return false

  log.debug('Connect: already connected, sending auth_success without OIDC')
  await completeDappConnect({
    target,
    ids: [id, ...additionalIds],
    jwt: existingJwt,
    chain,
    dappContext,
    silent,
  })
  return true
}

// Returns the zkLogin nonce for the chain, initializing device data if needed.
// Returns null (and sends an error to the tab) if the chain isn't zkLogin-capable
// or if initialization fails.
async function ensureNonce(
  chain: ReturnType<typeof getCurrentChain>,
  id: string,
  target: TabDocument,
): Promise<string | null> {
  if (!isZkLoginSuiChain(chain)) return null

  let nonce = useDeviceStore.getState().networkData[chain]?.nonce
  if (!nonce) {
    try {
      await useDeviceStore.getState().initializeForChain(chain)
    } catch (error) {
      log.error('Failed to initialize device data for chain', { chain, error })
      sendAuthErrorToTab(
        target,
        id,
        'Could not prepare sign-in. Please try again.',
      )
      return null
    }
    nonce = useDeviceStore.getState().networkData[chain]?.nonce
  }
  if (!nonce) {
    sendAuthErrorToTab(
      target,
      id,
      'Could not prepare sign-in. Please try again.',
    )
    return null
  }
  return nonce
}

// Processes the redirect URL from browser.identity.launchWebAuthFlow: exchanges
// the auth code for a JWT, stores it, and sends auth_success to the originating tab.
// `error` carries a launchWebAuthFlow rejection (user-cancel, no redirect).
async function handleOAuthCallback(
  responseUrl: string | undefined,
  ctx: OAuthCallbackContext,
  error?: unknown,
): Promise<void> {
  const {
    id,
    additionalIds,
    chain,
    chromeRedirectUri,
    tenant,
    codeVerifier,
    state,
    nonce,
    target,
    dappContext,
  } = ctx
  // The success path notifies the dApp via the tab; every failure path must do
  // the same, or the dApp's connect request hangs until it times out.
  const ids = [id, ...additionalIds]

  if (!responseUrl) {
    log.error('Auth flow returned no response', error)
    sendAuthErrorToTabIds(
      target,
      ids,
      (error instanceof Error ? error.message : undefined) ??
        'Sign-in did not complete. Please try again.',
    )
    return
  }

  if (extractState(responseUrl) !== state) {
    sendAuthErrorToTabIds(
      target,
      ids,
      'Invalid OAuth response (state mismatch)',
    )
    return
  }

  const authCode = extractAuthCode(responseUrl)
  if (!authCode) {
    sendAuthErrorToTabIds(
      target,
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
      { codeVerifier, nonce },
    )
    await storeJwt(jwtResponse)

    await completeDappConnect({
      target,
      ids,
      jwt: jwtResponse,
      chain,
      dappContext,
    })
  } catch (error) {
    log.error('Token exchange failed', error)
    sendAuthErrorToTabIds(
      target,
      ids,
      toErrorMessage(error, 'Sign-in failed. Please try again.'),
    )
  }
}

// Binds a connect message to the page document that sent it, then runs the connect.
export async function handleDappLogin(
  message: MessageWithId,
  sender: Browser.runtime.MessageSender,
  _sendResponse: (response?: unknown) => void,
  tabId?: number,
): Promise<void> {
  const id = ensureMessageId(message)
  if (typeof tabId !== 'number') return

  // Without a documentId no reply can be bound to the sender, so none is sent;
  // the page's own connect timeout settles the request.
  const { documentId } = sender
  if (!documentId) {
    log.warn('Dropping connect without a sender documentId', { tabId })
    return
  }
  const target = { tabId, documentId }

  const dappContext = getDappRequestContext(sender)
  if (!dappContext) {
    sendAuthErrorToTab(
      target,
      id,
      'Connect requests must come from a valid web page origin.',
    )
    return
  }

  await connectDapp({
    id,
    additionalIds: [],
    target,
    dappContext,
    silent: message.silent === true,
  })
}

// Runs a dapp connect: waits for the vault, then replies from the existing
// session or the OAuth flow. Every reply goes only to the request's document.
// A silent connect only replies from the existing session for an origin already
// permitted on the current chain, and is declined otherwise.
export async function connectDapp({
  id,
  additionalIds,
  target,
  dappContext,
  silent = false,
}: DappConnectRequest): Promise<void> {
  const tenant = useContextStore.getState().tenantId
  const chain = getCurrentChain()

  if (silent && !(await hasDappPermission(dappContext.origin, chain))) {
    declineSilentConnect(target, [id], dappContext, 'site not connected')
    return
  }

  const hasDeviceData = checkHasDeviceData()

  const keeperResult = await ensureKeeperReady(
    hasDeviceData,
    id,
    target,
    chain,
    dappContext,
    silent,
  )
  if (!keeperResult.ready) return

  if (!(await syncPublicKeyFromKeeper(keeperResult.publicKeyBytes, id, target)))
    return

  if (
    !useDeviceStore.getState().ephemeralPublicKey &&
    !isLocalnetChain(chain)
  ) {
    log.error('Keeper is unlocked but no public key bytes available', { chain })
    sendAuthErrorToTab(
      target,
      id,
      'Vault state is inconsistent. Please unlock the vault again.',
    )
    return
  }

  if (
    await checkExistingAuth(
      target,
      id,
      additionalIds,
      chain,
      dappContext,
      silent,
    )
  )
    return

  if (silent) {
    declineSilentConnect(target, [id], dappContext, 'not signed in')
    return
  }

  const nonce = await ensureNonce(chain, id, target)
  if (!nonce) return

  const chromeRedirectUri = browser.identity.getRedirectURL()
  const { authUrl, codeVerifier, state } = await getAuthRequest({
    tenantId: tenant,
    nonce,
  })
  const ctx: OAuthCallbackContext = {
    id,
    additionalIds,
    chain,
    chromeRedirectUri,
    tenant,
    codeVerifier,
    state,
    nonce,
    target,
    dappContext,
  }
  void browser.identity
    .launchWebAuthFlow({ url: authUrl.toString(), interactive: true })
    .then((responseUrl) => handleOAuthCallback(responseUrl, ctx))
    .catch((error) => handleOAuthCallback(undefined, ctx, error))
}
