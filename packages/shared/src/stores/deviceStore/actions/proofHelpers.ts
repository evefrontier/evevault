import { generateNonce } from '@mysten/sui/zklogin'
import type { SuiChain } from '@mysten/wallet-standard'
import { useAuthStore } from '#/auth'
import { getJwt } from '#/auth/storageService'
import { resolveVendedIdTokenForZkProof } from '#/auth/zkJwt'
import { zkProofService } from '#/services/vaultService'
import type { ZkProofResponse } from '#/types'
import type { JwtResponse } from '#/types/authTypes'
import { isLocalnetChain } from '#/types/networks'
import { createLogger } from '#/utils/logger'
import { fetchZkProof } from '#/wallet/zkProof'
import type { GetDeviceState, SetDeviceState } from './types'

type ZkProofResult = ZkProofResponse | { error: string }

type ProofInput = {
  chain: SuiChain
  network: string
  nonce: string
  networkJwtRandomness: string
  maxEpoch: string
  ephemeralPublicKey: NonNullable<
    ReturnType<GetDeviceState>['ephemeralPublicKey']
  >
  vendedIdToken: string
}

const log = createLogger()

/** Returns cached proof if epoch is still valid; generates a new one otherwise. Localnet has no zkLogin proof flow. */
export const getZkProofForChain = async (
  currentChain: SuiChain,
  set: SetDeviceState,
  get: GetDeviceState,
): Promise<ZkProofResult> => {
  if (isLocalnetChain(currentChain)) {
    return { error: 'zkLogin proofs are not available on localnet' }
  }

  const cachedProof = await getCachedZkProof(currentChain, get)
  return cachedProof ?? generateZkProof(currentChain, set, get)
}

/** Epoch expiry check prevents reusing a proof whose max epoch has passed, even if the keeper has it stored. */
const getCachedZkProof = async (
  currentChain: SuiChain,
  get: GetDeviceState,
): Promise<ZkProofResponse | null> => {
  const maxEpochExpiry = get().getMaxEpochTimestampMs(currentChain)
  if (!maxEpochExpiry || Date.now() >= maxEpochExpiry) {
    return null
  }

  try {
    const zkProof = await zkProofService.getZkProof(currentChain)
    if (zkProof != null && zkProof.error === undefined) {
      log.info('Max epoch not yet expired, reusing ZK proof from keeper')
      return zkProof
    }
  } catch (error) {
    log.warn('Failed to get zkProof from keeper, will generate new one:', error)
  }

  log.info('No ZK proof found in keeper, proceeding to generate new one')
  return null
}

const generateZkProof = async (
  chain: SuiChain,
  set: SetDeviceState,
  get: GetDeviceState,
): Promise<ZkProofResult> => {
  try {
    log.info('*********** Generating ZK proof ***********')
    const proofInput = await resolveProofInput(chain, get)
    const zkProofResponse = await requestZkProof(proofInput)
    await persistSuccessfulProof(chain, zkProofResponse)
    return zkProofResponse
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    log.error('Error generating ZK proof', error)
    set({ error: message })
    return { error: message }
  }
}

const resolveProofInput = async (
  chain: SuiChain,
  get: GetDeviceState,
): Promise<ProofInput> => {
  const network = chain.replace('sui:', '')
  requireAuthenticatedUser()
  const nonce = await ensureProofNonce(chain, network, get)
  const primaryJwt = await requirePrimaryJwt(network)
  const vendedIdToken = await resolveVendedIdTokenForZkProof(
    chain,
    primaryJwt,
    nonce,
    get().getMaxEpochTimestampMs(chain),
  )

  return {
    chain,
    network,
    nonce,
    vendedIdToken,
    ephemeralPublicKey: requireEphemeralPublicKey(get),
    networkJwtRandomness: requireJwtRandomness(chain, network, get),
    maxEpoch: requireMaxEpoch(chain, get),
  }
}

const requireAuthenticatedUser = () => {
  const { user } = useAuthStore.getState()
  if (!user?.id_token) {
    throw new Error('User not authenticated')
  }
}

/** The nonce is cryptographically bound to the ephemeral key and epoch; rotating the key also refreshes the nonce. */
const ensureProofNonce = async (
  chain: SuiChain,
  network: string,
  get: GetDeviceState,
): Promise<string> => {
  const nonce = get().getNonce(chain)
  if (
    nonce &&
    !isEpochExpired(chain, get) &&
    isNonceBoundToCurrentKey(chain, get, nonce)
  ) {
    return nonce
  }

  log.info(
    'Device nonce missing, epoch expired, or bound to a stale ephemeral key; rotating ephemeral key',
    { chain },
  )
  await get().rotateEphemeralKey(chain)
  return requireNonceAfterRotation(chain, network, get)
}

/**
 * Recomputes the nonce from the current ephemeral key, epoch, and randomness and
 * compares it to the stored nonce. The ephemeral key lives in a different store
 * than the per-chain nonce, so a key rotation elsewhere can leave the stored nonce
 * bound to a stale key; this catches that mismatch before Enoki rejects it as
 * incorrect_nonce.
 */
const isNonceBoundToCurrentKey = (
  chain: SuiChain,
  get: GetDeviceState,
  nonce: string,
): boolean => {
  const ephemeralPublicKey = get().ephemeralPublicKey
  const maxEpoch = get().getMaxEpoch(chain)
  const jwtRandomness = get().getJwtRandomness(chain)
  if (!ephemeralPublicKey || !maxEpoch || !jwtRandomness) {
    return false
  }
  try {
    return (
      generateNonce(ephemeralPublicKey, Number(maxEpoch), jwtRandomness) ===
      nonce
    )
  } catch {
    // Malformed stored epoch/randomness can't recompute; treat as unbound so the
    // caller rotates and regenerates from scratch.
    return false
  }
}

const requireNonceAfterRotation = (
  chain: SuiChain,
  network: string,
  get: GetDeviceState,
): string => {
  const nonce = get().getNonce(chain)
  if (!nonce) {
    throw new Error(`Device nonce missing for ${network} after initialization.`)
  }
  return nonce
}

const requirePrimaryJwt = async (network: string): Promise<JwtResponse> => {
  const primaryJwt = await getJwt()
  if (!primaryJwt?.id_token) {
    throw new Error(`No valid JWT found for ${network}. Please sign in again.`)
  }
  return primaryJwt as JwtResponse
}

const requireEphemeralPublicKey = (get: GetDeviceState) => {
  const ephemeralPublicKey = get().ephemeralPublicKey
  if (!ephemeralPublicKey) {
    throw new Error('Ephemeral public key not found')
  }
  return ephemeralPublicKey
}

const requireJwtRandomness = (
  chain: SuiChain,
  network: string,
  get: GetDeviceState,
): string => {
  const networkJwtRandomness = get().getJwtRandomness(chain)
  if (!networkJwtRandomness) {
    throw new Error(
      `JWT randomness not found for ${network}. Please sign in again.`,
    )
  }
  return networkJwtRandomness
}

const requireMaxEpoch = (chain: SuiChain, get: GetDeviceState): string => {
  const maxEpoch = get().getMaxEpoch(chain)
  if (!maxEpoch) {
    throw new Error('Max epoch not found for current network')
  }
  return maxEpoch
}

const isEpochExpired = (chain: SuiChain, get: GetDeviceState): boolean => {
  const maxEpochTimestampMs = get().getMaxEpochTimestampMs(chain)
  return maxEpochTimestampMs == null || Date.now() >= maxEpochTimestampMs
}

const requestZkProof = async ({
  chain,
  network,
  networkJwtRandomness,
  maxEpoch,
  ephemeralPublicKey,
  vendedIdToken,
}: ProofInput): Promise<ZkProofResponse> => {
  log.debug('Generating ZK proof for network', { chain, network })
  const data = await fetchZkProof({
    jwtRandomness: networkJwtRandomness,
    maxEpoch,
    ephemeralPublicKey,
    idToken: vendedIdToken,
    network,
  })
  return { data, error: undefined }
}

/** Stores the proof in the keeper service so it can be reused across sessions within the same epoch. */
const persistSuccessfulProof = async (
  chain: SuiChain,
  zkProofResponse: ZkProofResponse,
) => {
  try {
    await zkProofService.setZkProof(chain, zkProofResponse)
    log.debug('zkProof stored in keeper')
  } catch (error) {
    log.error('Failed to store zkProof in keeper:', error)
  }
}
