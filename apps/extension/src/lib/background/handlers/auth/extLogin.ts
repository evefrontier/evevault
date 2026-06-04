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
  sendAuthSuccess,
} from './authHelpers'
import {
  checkKeeperUnlocked,
  getEphemeralKeyPairSecretKeyFromStorage,
} from './keeperHelpers'
import { KEEPER_RETRY_DELAY_MS, setPendingAuthAfterUnlock } from './pendingAuth'

const log = createLogger()
const KEEPER_RETRY_DELAYS_MS = [
  KEEPER_RETRY_DELAY_MS,
  KEEPER_RETRY_DELAY_MS * 3,
] as const

type KeeperStatus = Awaited<ReturnType<typeof checkKeeperUnlocked>>
type CurrentChain = ReturnType<typeof getCurrentChain>
type StoredChain = Awaited<ReturnType<typeof getCurrentChainFromStorage>>
type PublicKeySyncResult = 'ok' | 'failed'

function resolveTenantId(message: MessageWithId): TenantId {
  if (
    typeof message.tenantId === 'string' &&
    isAvailableTenantId(message.tenantId)
  ) {
    return message.tenantId as TenantId
  }

  return getCurrentTenantId()
}

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
    sendAuthSuccess(id, jwtResponse)
  } catch (error) {
    sendAuthError(id, error)
  }
}

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
