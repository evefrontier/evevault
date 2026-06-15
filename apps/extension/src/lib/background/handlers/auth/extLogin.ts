import { storeJwt, type TenantId } from '@evevault/shared'
import { exchangeCodeForToken } from '@evevault/shared/auth'
import {
  getCurrentTenantId,
  isAvailableTenantId,
  useDeviceStore,
} from '@evevault/shared/stores'
import { createLogger } from '@evevault/shared/utils'
import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519'
import { getAuthRequest } from '@/lib/background/services/oauthService'
import { openPopupWindow } from '@/lib/background/services/popupWindow'
import type { MessageWithId } from '@/lib/background/types'
import {
  ensureMessageId,
  extractAuthCode,
  getCurrentChain,
  getCurrentChainFromStorage,
  sendAuthError,
  sendExtensionAuthSuccess,
} from './authHelpers'
import {
  checkKeeperUnlocked,
  getEphemeralKeyPairSecretKeyFromStorage,
} from './keeperHelpers'
import { KEEPER_RETRY_DELAY_MS, setPendingAuthAfterUnlock } from './pendingAuth'

type KeeperStatus = Awaited<ReturnType<typeof checkKeeperUnlocked>>
type CurrentChain = ReturnType<typeof getCurrentChain>
type StoredChain = Awaited<ReturnType<typeof getCurrentChainFromStorage>>
type PublicKeySyncResult = 'ok' | 'failed'

const log = createLogger()
const KEEPER_RETRY_DELAYS_MS = [
  KEEPER_RETRY_DELAY_MS,
  KEEPER_RETRY_DELAY_MS * 3,
] as const

/**
 * Coordinates the extension OAuth login flow after the keeper has unlocked the
 * device state, preserving the selected chain across the async browser auth
 * round trip.
 */
export async function handleExtLogin(
  message: MessageWithId,
  _sender: chrome.runtime.MessageSender,
  _sendResponse: (response?: unknown) => void,
): Promise<void> {
  const id = ensureMessageId(message)
  const tenantId = resolveTenantId(message)
  const initialChain = getCurrentChain()
  const deviceStore = useDeviceStore.getState()
  const key = deviceStore.ephemeralKeyPairSecretKey
  const hasDeviceData =
    Boolean(key) && typeof key === 'object' && 'iv' in key && 'data' in key
  const keeperStatus = await getKeeperStatus(hasDeviceData)
  if (!keeperStatus.unlocked) {
    await requestVaultUnlock({ id, initialChain, hasDeviceData, tenantId })
    return
  }

  const didSync = await syncPublicKeyFromKeeper({
    id,
    initialChain,
    keeperStatus,
  })
  if (didSync === 'failed') return
  if (!ensureDevicePublicKey(id, initialChain)) return

  const currentChain = await getCurrentChainFromStorage()
  const nonce = await getNonceForChain(id, currentChain)
  if (!nonce) return

  const { authUrl, codeVerifier } = await getAuthRequest({ tenantId, nonce })
  launchOAuthLogin({ id, authUrl, codeVerifier, currentChain, tenantId })
}

/**
 * Resolves tenant ids defensively because dApp-originated messages can include
 * arbitrary strings while the extension must only login against configured
 * tenants.
 */
function resolveTenantId(message: MessageWithId): TenantId {
  if (
    typeof message.tenantId === 'string' &&
    isAvailableTenantId(message.tenantId)
  ) {
    return message.tenantId as TenantId
  }

  return getCurrentTenantId()
}

/**
 * Retries keeper unlock checks briefly when persisted device data exists
 * because the keeper worker can lag behind popup startup during extension
 * login.
 */
async function getKeeperStatus(hasDeviceData: boolean): Promise<KeeperStatus> {
  let keeperStatus = await checkKeeperUnlocked()
  if (keeperStatus.unlocked || !hasDeviceData) return keeperStatus

  for (const retryDelay of KEEPER_RETRY_DELAYS_MS) {
    await new Promise<void>((resolve) => setTimeout(resolve, retryDelay))
    keeperStatus = await checkKeeperUnlocked()
    if (keeperStatus.unlocked) break
  }

  return keeperStatus
}

/**
 * Opens the popup and records pending auth only when a vault already exists, so
 * setup-required users get an immediate retry instruction instead of a hidden
 * queued login.
 */
async function requestVaultUnlock({
  id,
  initialChain,
  hasDeviceData,
  tenantId,
}: {
  id: string
  initialChain: CurrentChain
  hasDeviceData: boolean
  tenantId: TenantId
}) {
  log.error('Cannot login: vault not set up or locked', {
    chain: initialChain,
    hasDeviceData,
  })

  useDeviceStore.setState({ isLocked: true })
  const windowId = await openPopupWindow('popup')
  if (windowId === undefined) {
    log.warn('Failed to open vault popup window')
  }

  if (hasDeviceData) {
    setPendingAuthAfterUnlock(id, 'ext', undefined, windowId, tenantId)
    return
  }

  sendAuthError(id, {
    message:
      'Please set up or unlock the vault in the window we opened, then try again.',
    vaultOpened: true,
  })
}

/**
 * Copies the keeper's public key back into device state after unlock because
 * OAuth nonce generation and account checks read from the shared device store.
 */
async function syncPublicKeyFromKeeper({
  id,
  initialChain,
  keeperStatus,
}: {
  id: string
  initialChain: CurrentChain
  keeperStatus: KeeperStatus
}): Promise<PublicKeySyncResult> {
  const deviceStore = useDeviceStore.getState()
  if (deviceStore.ephemeralPublicKey) return 'ok'
  if (!keeperStatus.publicKeyBytes) return 'ok'

  log.info('Syncing ephemeral public key from keeper to deviceStore', {
    chain: initialChain,
  })

  try {
    const publicKey = new Ed25519PublicKey(
      new Uint8Array(keeperStatus.publicKeyBytes),
    )
    const secretKeyToPreserve =
      deviceStore.ephemeralKeyPairSecretKey ||
      (await getEphemeralKeyPairSecretKeyFromStorage())

    useDeviceStore.setState({
      ephemeralPublicKey: publicKey,
      ephemeralPublicKeyBytes: keeperStatus.publicKeyBytes,
      ephemeralPublicKeyFlag: publicKey.flag(),
      ephemeralKeyPairSecretKey: secretKeyToPreserve,
      isLocked: false,
    })
    log.debug('Successfully synced ephemeral public key to deviceStore')
    return 'ok'
  } catch (error) {
    log.error('Failed to sync public key from keeper', error)
    sendAuthError(id, {
      message: 'Failed to sync vault state. Please try unlocking again.',
    })
    return 'failed'
  }
}

/**
 * Verifies that an unlocked keeper also produced a public key before starting
 * OAuth, avoiding a login that would succeed but be unusable for zkLogin.
 */
function ensureDevicePublicKey(
  id: string,
  initialChain: CurrentChain,
): boolean {
  if (useDeviceStore.getState().ephemeralPublicKey) return true

  log.error('Keeper is unlocked but no public key bytes available', {
    chain: initialChain,
  })
  sendAuthError(id, {
    message: 'Vault state is inconsistent. Please unlock the vault again.',
  })
  return false
}

/**
 * Initializes per-chain device data on demand so extension login can recover
 * when a network was selected before nonce state existed.
 */
async function getNonceForChain(
  id: string,
  currentChain: StoredChain,
): Promise<string | null> {
  let nonce = useDeviceStore.getState().networkData[currentChain]?.nonce
  if (nonce) return nonce

  try {
    await useDeviceStore.getState().initializeForChain(currentChain)
  } catch (error) {
    log.error('Failed to initialize device data for chain', {
      currentChain,
      error,
    })
    sendAuthError(id, {
      message: 'Could not prepare sign-in. Please try again.',
    })
    return null
  }

  nonce = useDeviceStore.getState().networkData[currentChain]?.nonce
  if (nonce) return nonce

  sendAuthError(id, {
    message: 'Could not prepare sign-in. Please try again.',
  })
  return null
}

/**
 * Completes the browser OAuth callback while rejecting responses if the active
 * network changed during auth, which would otherwise store a JWT under the
 * wrong chain.
 */
async function handleOAuthResponse({
  id,
  responseUrl,
  codeVerifier,
  currentChain,
  tenantId,
}: {
  id: string
  responseUrl: string | undefined
  codeVerifier: string
  currentChain: StoredChain
  tenantId: TenantId
}) {
  if (chrome.runtime.lastError) {
    sendAuthError(id, chrome.runtime.lastError)
    return
  }

  if (!responseUrl) {
    sendAuthError(id, { message: 'No response URL received' })
    return
  }

  try {
    const authCode = extractAuthCode(responseUrl)
    if (!authCode) {
      sendAuthError(id, { message: 'No authorization code received' })
      return
    }

    const jwtResponse = await exchangeCodeForToken(
      authCode,
      chrome.identity.getRedirectURL(),
      tenantId,
      { codeVerifier },
    )

    const chainAfterOAuth = await getCurrentChainFromStorage()
    if (chainAfterOAuth !== currentChain) {
      log.error('Network changed during OAuth flow - aborting login', {
        chainAtOAuthStart: currentChain,
        chainAfterOAuth,
      })
      sendAuthError(id, {
        message:
          'Network was switched during login. Please try logging in again.',
      })
      return
    }

    log.info('Storing JWT for network', {
      chain: currentChain,
      hasJwt: !!jwtResponse.id_token,
    })
    await storeJwt(jwtResponse, currentChain)
    sendExtensionAuthSuccess(id, jwtResponse)
  } catch (error) {
    sendAuthError(id, error)
  }
}

/**
 * Starts Chrome's web auth flow and delegates async response handling without
 * returning a promise to the Chrome callback API.
 */
function launchOAuthLogin({
  id,
  authUrl,
  codeVerifier,
  currentChain,
  tenantId,
}: {
  id: string
  authUrl: URL
  codeVerifier: string
  currentChain: StoredChain
  tenantId: TenantId
}) {
  chrome.identity.launchWebAuthFlow(
    { url: authUrl.toString(), interactive: true },
    (responseUrl) => {
      void handleOAuthResponse({
        id,
        responseUrl,
        codeVerifier,
        currentChain,
        tenantId,
      })
    },
  )
}
