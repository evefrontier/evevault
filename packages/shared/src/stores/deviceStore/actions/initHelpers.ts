import type { PublicKey } from '@mysten/sui/cryptography'
import { generateNonce, generateRandomness } from '@mysten/sui/zklogin'
import type { SuiChain } from '@mysten/wallet-standard'
import { clearAllZkLoginJwts } from '#/auth/storageService'
import { ephKeyService, zkProofService } from '#/services/vaultService'
import { createInitialNetworkData } from '#/stores/deviceStore/constants'
import { resolveStoredSecretKey } from '#/stores/deviceStore/keyHelpers'
import { getCurrentEpochFromGraphQL } from '#/sui/graphqlEpoch'
import { getCurrentEpochFromRpc } from '#/sui/rpcEpoch'
import type {
  DeviceState,
  LocalnetDeviceData,
  NetworkDataEntry,
  NetworkDataMap,
  PersistedDeviceStore,
  PersistedDeviceStoreState,
  StoredSecretKey,
} from '#/types'
import { isLocalnetChain, isZkLoginSuiChain } from '#/types/networks'
import { createWebCryptoPlaceholder } from '#/types/wallet'
import { isWeb } from '#/utils/environment'
import { createLogger } from '#/utils/logger'
import { DEVICE_STORAGE_KEY } from '#/utils/storageKeys'
import type { GetDeviceState, SetDeviceState } from './types'

const log = createLogger()

type ChainDeviceData = Pick<
  NetworkDataEntry,
  'maxEpoch' | 'maxEpochTimestampMs' | 'nonce'
>

type ExtensionRehydrationResult = {
  rehydrated: boolean
  storedSecretKey: StoredSecretKey
  jwtRandomness: string | null
}

type InitActionParams = {
  pin: string
  currentChain: SuiChain
  set: SetDeviceState
  get: GetDeviceState
}

const EMPTY_NETWORK_DATA: NetworkDataEntry = {
  maxEpoch: null,
  nonce: null,
  maxEpochTimestampMs: null,
  jwtRandomness: null,
}

export const isBlankPin = (pin: string): boolean => pin.trim().length === 0

export const getNetworkDataEntry = (
  state: DeviceState,
  chain: SuiChain,
): NetworkDataEntry => {
  return isZkLoginSuiChain(chain)
    ? (state.networkData[chain] ?? EMPTY_NETWORK_DATA)
    : EMPTY_NETWORK_DATA
}

export const isDeviceDataExpired = (
  data?: Pick<NetworkDataEntry, 'maxEpochTimestampMs'>,
): boolean =>
  data?.maxEpochTimestampMs != null && Date.now() >= data.maxEpochTimestampMs

export const hasFreshNetworkData = (
  data: NetworkDataEntry,
  storedSecretKey: StoredSecretKey,
): boolean => {
  return (
    [
      data.jwtRandomness,
      data.maxEpoch,
      data.nonce,
      data.maxEpochTimestampMs,
      storedSecretKey,
    ].every(Boolean) && !isDeviceDataExpired(data)
  )
}

export const needsPersistedRehydration = (
  data: NetworkDataEntry,
  storedSecretKey: StoredSecretKey,
): boolean => {
  return [
    data.jwtRandomness,
    data.maxEpoch,
    data.nonce,
    data.maxEpochTimestampMs,
    storedSecretKey,
  ].some((value) => !value)
}

export const hasChainDeviceData = (data?: ChainDeviceData): boolean => {
  return Boolean(data?.nonce && data.maxEpoch && !isDeviceDataExpired(data))
}

export const getCurrentChainDeviceData = (
  state: DeviceState,
  chain: SuiChain,
): ChainDeviceData | undefined => {
  if (isLocalnetChain(chain)) {
    return {
      maxEpoch: state.localnet.maxEpoch,
      maxEpochTimestampMs: state.localnet.maxEpochTimestampMs,
      nonce: 'localnet',
    }
  }

  return isZkLoginSuiChain(chain) ? state.networkData[chain] : undefined
}

export const setPublicKeyState = (
  set: SetDeviceState,
  publicKey: PublicKey,
  secretKey?: StoredSecretKey,
) => {
  set({
    ephemeralPublicKey: publicKey,
    ephemeralPublicKeyBytes: Array.from(publicKey.toRawBytes()),
    ephemeralPublicKeyFlag: publicKey.flag(),
    ...(secretKey === undefined
      ? {}
      : { ephemeralKeyPairSecretKey: secretKey }),
  })
}

export const readPersistedDeviceStoreState =
  async (): Promise<PersistedDeviceStoreState | null> => {
    const persistedDeviceStore = await new Promise<unknown>((resolve) => {
      chrome.storage.local.get([DEVICE_STORAGE_KEY], (result) => {
        resolve(result[DEVICE_STORAGE_KEY] || null)
      })
    })

    return parsePersistedDeviceStoreState(persistedDeviceStore)
  }

const parsePersistedDeviceStoreState = (
  persistedDeviceStore: unknown,
): PersistedDeviceStoreState | null => {
  if (!persistedDeviceStore) {
    return null
  }

  if (typeof persistedDeviceStore === 'string') {
    return (
      (JSON.parse(persistedDeviceStore) as PersistedDeviceStore).state ?? null
    )
  }

  if (
    typeof persistedDeviceStore === 'object' &&
    'state' in persistedDeviceStore
  ) {
    return (persistedDeviceStore as PersistedDeviceStore).state ?? null
  }

  return null
}

export const tryRehydrateExtensionDevice = async ({
  pin,
  currentChain,
  currentNetworkData,
  storedSecretKey,
  fallbackNetworkData,
  set,
}: {
  pin: string
  currentChain: SuiChain
  currentNetworkData: NetworkDataEntry
  storedSecretKey: StoredSecretKey
  fallbackNetworkData: NetworkDataMap
  set: SetDeviceState
}): Promise<ExtensionRehydrationResult> => {
  const emptyResult = {
    rehydrated: false,
    storedSecretKey,
    jwtRandomness: currentNetworkData.jwtRandomness,
  }

  try {
    const persistedDeviceStoreState = await readPersistedDeviceStoreState()
    if (!persistedDeviceStoreState) {
      return emptyResult
    }

    const persistedNetworkData = isZkLoginSuiChain(currentChain)
      ? persistedDeviceStoreState.networkData?.[currentChain]
      : undefined
    const jwtRandomness =
      persistedNetworkData?.jwtRandomness ?? currentNetworkData.jwtRandomness
    const resolvedSecretKey = await resolveStoredSecretKey(
      persistedDeviceStoreState.ephemeralKeyPairSecretKey ?? storedSecretKey,
      pin,
    )

    if (!jwtRandomness || !resolvedSecretKey) {
      return {
        rehydrated: false,
        storedSecretKey: resolvedSecretKey,
        jwtRandomness,
      }
    }

    log.debug('Rehydrating device store from persisted data')
    set({
      ephemeralKeyPairSecretKey: resolvedSecretKey,
      networkData: persistedDeviceStoreState.networkData ?? fallbackNetworkData,
      loading: false,
      error: null,
    })
    return {
      rehydrated: true,
      storedSecretKey: resolvedSecretKey,
      jwtRandomness,
    }
  } catch (parseError) {
    log.error('Error parsing persisted device store', parseError)
    return emptyResult
  }
}

export const initializeDeviceStore = async ({
  pin,
  currentChain,
  set,
  get,
}: InitActionParams) => {
  set({ loading: true })

  if (isBlankPin(pin)) {
    set({ error: 'PIN is required', loading: false })
    return
  }

  try {
    await ephKeyService.initialize()

    if (isWeb()) {
      await initializeWebDevice({
        pin,
        currentChain,
        currentNetworkData: getNetworkDataEntry(get(), currentChain),
        set,
        get,
      })
      return
    }

    await initializeExtensionDevice({ pin, currentChain, set, get })
  } catch (error) {
    log.error('Error handling private key', error)
    set({
      error: error instanceof Error ? error.message : 'Unknown error',
      loading: false,
    })
  }
}

export const initializeForChainData = async (
  chain: SuiChain,
  set: SetDeviceState,
  get: GetDeviceState,
) => {
  log.info('Generating device data for chain', { chain })

  if (isLocalnetChain(chain)) {
    await initializeLocalnetChainData(set, get)
    return
  }

  await initializeZkLoginChainData(chain, set, get)
}

export const rotateEphemeralKeyForChain = async (
  currentChain: SuiChain,
  set: SetDeviceState,
  get: GetDeviceState,
) => {
  log.info('Rotating ephemeral key', { currentChain })

  // Clear derived state before generating the new key. If rotateEphemeralKeyPair()
  // subsequently fails, JWTs and proofs are already cleared but the key is unchanged;
  // state is partially reset until initializeForChain is called again.
  await Promise.all([clearAllZkLoginJwts(), zkProofService.clear()])

  const { hashedSecretKey, publicKey } =
    await ephKeyService.rotateEphemeralKeyPair()

  set({
    ephemeralPublicKey: publicKey,
    ephemeralPublicKeyBytes: Array.from(publicKey.toRawBytes()),
    ephemeralPublicKeyFlag: publicKey.flag(),
    ephemeralKeyPairSecretKey: isWeb()
      ? createWebCryptoPlaceholder()
      : hashedSecretKey,
    networkData: createInitialNetworkData(),
    error: null,
    isLocked: false,
  })

  await get().initializeForChain(currentChain)
}

const initializeLocalnetChainData = async (
  set: SetDeviceState,
  get: GetDeviceState,
) => {
  const localnetUrl = get().localnet.url
  if (!localnetUrl) {
    log.warn('Localnet URL not configured, skipping epoch fetch')
    setLocalnetEpochData(set, get, {
      maxEpoch: null,
      maxEpochTimestampMs: null,
    })
    return
  }

  try {
    const { numericMaxEpoch, maxEpochTimestampMs } =
      await getCurrentEpochFromRpc(localnetUrl)
    setLocalnetEpochData(set, get, {
      maxEpoch: numericMaxEpoch.toString(),
      maxEpochTimestampMs,
    })
  } catch (err) {
    log.error('Failed to fetch localnet epoch', err)
    setLocalnetEpochData(set, get, {
      maxEpoch: null,
      maxEpochTimestampMs: null,
    })
  }
}

const initializeZkLoginChainData = async (
  chain: SuiChain,
  set: SetDeviceState,
  get: GetDeviceState,
) => {
  if (!isZkLoginSuiChain(chain)) return

  const ephemeralPubkey = get().ephemeralPublicKey
  if (!ephemeralPubkey) {
    throw new Error('Ephemeral public key not found')
  }

  const jwtRandomness = generateRandomness().toString()
  const { numericMaxEpoch, maxEpochTimestampMs } =
    await getCurrentEpochFromGraphQL(chain)
  const nonce = generateNonce(ephemeralPubkey, numericMaxEpoch, jwtRandomness)

  setChainData(set, get, chain, {
    maxEpoch: numericMaxEpoch.toString(),
    maxEpochTimestampMs,
    nonce,
    jwtRandomness,
  })
}

const setLocalnetEpochData = (
  set: SetDeviceState,
  get: GetDeviceState,
  epochData: Pick<LocalnetDeviceData, 'maxEpoch' | 'maxEpochTimestampMs'>,
) => {
  set({
    localnet: {
      ...get().localnet,
      ...epochData,
    },
    error: null,
  })
}

const setChainData = (
  set: SetDeviceState,
  get: GetDeviceState,
  chain: SuiChain,
  data: NetworkDataEntry,
) => {
  if (!isZkLoginSuiChain(chain)) return
  set({
    networkData: {
      ...get().networkData,
      [chain]: data,
    },
    error: null,
  })
}

export const initializeWebDevice = async ({
  pin,
  currentChain,
  currentNetworkData,
  set,
  get,
}: {
  pin: string
  currentChain: SuiChain
  currentNetworkData: NetworkDataEntry
  set: SetDeviceState
  get: GetDeviceState
}): Promise<void> => {
  const hasExistingKeypair = await ephKeyService.hasKeypair()

  if (hasExistingKeypair) {
    log.info('[web] Found existing encrypted keypair in IndexedDB')
    const publicKey = await ephKeyService.unlockVault(null, pin)

    if (publicKey) {
      setPublicKeyState(set, publicKey, createWebCryptoPlaceholder())
      if (!hasChainDeviceData(currentNetworkData)) {
        await get().initializeForChain(currentChain)
      }
      set({ loading: false, isLocked: false })
      return
    }
  }

  log.info('[web] Creating new Secp256r1 keypair (encrypted with PIN)')
  const { publicKey } = await ephKeyService.createEphemeralKeyPair(pin)
  setPublicKeyState(set, publicKey, createWebCryptoPlaceholder())

  await get().initializeForChain(currentChain)
  set({ loading: false, isLocked: false })
}

export const initializeExtensionDevice = async ({
  pin,
  currentChain,
  set,
  get,
}: InitActionParams) => {
  const currentState = get()
  const networkDataEntry = getNetworkDataEntry(currentState, currentChain)
  const normalizedCurrentSecretKey = await resolveStoredSecretKey(
    currentState.ephemeralKeyPairSecretKey,
    pin,
  )
  let storedSecretKey = normalizedCurrentSecretKey

  if (hasFreshNetworkData(networkDataEntry, storedSecretKey)) {
    log.debug('Device store already initialized, skipping re-init')
    set({ loading: false })
    return
  }

  if (needsPersistedRehydration(networkDataEntry, storedSecretKey)) {
    const rehydration = await tryRehydrateExtensionDevice({
      pin,
      currentChain,
      currentNetworkData: networkDataEntry,
      storedSecretKey,
      fallbackNetworkData: currentState.networkData,
      set,
    })
    storedSecretKey = rehydration.storedSecretKey

    if (rehydration.rehydrated) {
      return
    }
  }

  await ensureExtensionKeypair({
    pin,
    currentState,
    storedSecretKey,
    set,
  })

  if (!get().ephemeralPublicKey) {
    throw new Error('Ephemeral public key not available after initialization')
  }

  await initializeChainIfNeeded(currentChain, get)
  set({ loading: false, isLocked: false })
}

export const ensureExtensionKeypair = async ({
  pin,
  currentState,
  storedSecretKey,
  set,
}: {
  pin: string
  currentState: DeviceState
  storedSecretKey: StoredSecretKey
  set: SetDeviceState
}): Promise<void> => {
  const needsNewKeyPair =
    !storedSecretKey || !currentState.ephemeralKeyPairSecretKey

  if (needsNewKeyPair) {
    log.info('No existing ephemeral key pair found, creating new one')
    const { hashedSecretKey, publicKey } =
      await ephKeyService.createEphemeralKeyPair(pin)

    if (!hashedSecretKey || !publicKey) {
      throw new Error('Failed to create ephemeral key pair')
    }

    log.debug('Created new ephemeral key pair')
    setPublicKeyState(set, publicKey, hashedSecretKey)
    return
  }

  log.info('Existing ephemeral key pair found, unlocking vault')
  await ephKeyService.unlockVault(storedSecretKey, pin)
  const refreshedPublicKey = await ephKeyService.getEphemeralPublicKey()

  if (refreshedPublicKey) {
    setPublicKeyState(set, refreshedPublicKey)
  }
}

export const initializeChainIfNeeded = async (
  currentChain: SuiChain,
  get: GetDeviceState,
) => {
  const currentDeviceData = getCurrentChainDeviceData(get(), currentChain)
  if (hasChainDeviceData(currentDeviceData)) {
    return
  }

  log.info('Initializing device store for chain', { chain: currentChain })
  await get().initializeForChain(currentChain)
}
