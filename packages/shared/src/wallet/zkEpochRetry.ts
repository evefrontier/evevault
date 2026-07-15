import type { SuiChain } from '@mysten/wallet-standard'
import { isLocalnetChain } from '#/types/networks'
import { createLogger } from '#/utils/logger'

const log = createLogger()

/**
 * Matches the fullnode rejection for a zkLogin signature whose max epoch has
 * passed (e.g. "ZKLogin expired at epoch 17, current epoch 18"). RPC error
 * messages may arrive URL-encoded.
 */
export const isZkLoginEpochExpiredError = (error: unknown): boolean => {
  if (!(error instanceof Error) || !error.message) return false
  let message = error.message
  try {
    message = decodeURIComponent(message)
  } catch {
    // not URL-encoded; match against the raw message
  }
  return /zklogin expired at epoch/i.test(message)
}

/**
 * Runs a sign+submit operation and, if the chain rejects the signature because
 * the proof's max epoch has passed, rotates the ephemeral key (clearing cached
 * proofs and re-vending a JWT for the fresh nonce) and retries once. Rotation
 * does not change the zkLogin address, so transaction bytes built before the
 * retry remain valid.
 */
export const withZkLoginEpochRetry = async <T>(
  chain: SuiChain,
  signAndSubmit: () => Promise<T>,
): Promise<T> => {
  try {
    return await signAndSubmit()
  } catch (error) {
    if (isLocalnetChain(chain) || !isZkLoginEpochExpiredError(error)) {
      throw error
    }
    log.warn(
      'zkLogin proof expired on-chain; rotating ephemeral key and retrying',
      { chain },
    )
    // Lazy import keeps the device store out of this module's static graph
    const { useDeviceStore } = await import('#/stores/deviceStore')
    await useDeviceStore.getState().rotateEphemeralKey(chain)
    return signAndSubmit()
  }
}
