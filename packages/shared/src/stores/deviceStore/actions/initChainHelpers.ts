import { generateNonce, generateRandomness } from '@mysten/sui/zklogin'
import type { SuiChain } from '@mysten/wallet-standard'
import { clearAllZkLoginJwts } from '#/auth/storageService'
import { zkProofService } from '#/services/vaultService'
import { createInitialNetworkData } from '#/stores/deviceStore/constants'
import { getCurrentEpochFromGraphQL } from '#/sui/graphqlEpoch'
import { getCurrentEpochFromRpc } from '#/sui/rpcEpoch'
import type { LocalnetDeviceData, NetworkDataEntry } from '#/types'
import { isLocalnetChain, isZkLoginSuiChain } from '#/types/networks'
import { createWebCryptoPlaceholder } from '#/types/wallet'
import { isWeb } from '#/utils/environment'
import { createLogger } from '#/utils/logger'
import {
  getCurrentChainDeviceData,
  hasChainDeviceData,
} from './initStateHelpers'
import type { GetDeviceState, SetDeviceState } from './types'

const log = createLogger()

const NULL_EPOCH = { maxEpoch: null, maxEpochTimestampMs: null } as const

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

/** Clears JWTs and cached ZK proofs before rotating so stale proofs tied to the old key can't be reused. */
export const rotateEphemeralKeyForChain = async (
  currentChain: SuiChain,
  set: SetDeviceState,
  get: GetDeviceState,
) => {
  log.info('Rotating ephemeral key', { currentChain })
  await clearDerivedZkLoginState()

  const { ephKeyService } = await import('#/services/vaultService')
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

/** Guards against redundant network calls when the chain was already initialized (e.g. after rehydration). */
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

const clearDerivedZkLoginState = async () => {
  // If key rotation fails, JWTs and proofs are already cleared but the old key
  // remains. State is partially reset until initializeForChain is called again.
  await Promise.all([clearAllZkLoginJwts(), zkProofService.clear()])
}

/** Localnet epoch comes from the local RPC rather than GraphQL; missing URL is non-fatal — nonce stays null. */
const initializeLocalnetChainData = async (
  set: SetDeviceState,
  get: GetDeviceState,
) => {
  const localnetUrl = get().localnet.url
  if (!localnetUrl) {
    log.warn('Localnet URL not configured, skipping epoch fetch')
    setLocalnetEpochData(set, get, NULL_EPOCH)
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
    setLocalnetEpochData(set, get, NULL_EPOCH)
  }
}

/** Nonce binds the ephemeral key to a specific epoch window; both must be generated together. */
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
